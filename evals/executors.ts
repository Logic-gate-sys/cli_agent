import { openai } from "@ai-sdk/openai";
import { z } from 'zod'; 
import { generateText, stepCountIs, tool, type ModelMessage, type ToolSet } from "ai";
import type {
  EvalData,
  MultiTurnEvalData,
  MultiTurnResult,
} from "./types.ts";
import { buildMessages, buildMockedTools } from "./utils.ts";
import { SYSTEM_PROMPT } from "../src/agent/system/prompt.ts";


const MODEL_NAME = 'gpt-5-mini';

// tool definitions for evals
const TOOL_DEFINITIONS: Record<string,{ description: string; parameters: z.ZodObject<z.ZodRawShape> }> = {
  // File tools
  readFile: {
    description: "Read the contents of a file at the specified path",
    parameters: z.object({
      path: z.string().describe("The path to the file to read"),
    }),
  },
  writeFile: {
    description: "Write content to a file at the specified path",
    parameters: z.object({
      path: z.string().describe("The path to the file to write"),
      content: z.string().describe("The content to write to the file"),
    }),
  },
  listFiles: {
    description: "List all files in a directory",
    parameters: z.object({
      path: z.string().describe("The directory path to list files from"),
    }),
  },
  deleteFile: {
    description: "Delete a file at the specified path",
    parameters: z.object({
      path: z.string().describe("The path to the file to delete"),
    }),
  },
  // Shell tools
  runCommand: {
    description: "Execute a shell command and return its output",
    parameters: z.object({
      command: z.string().describe("The shell command to execute"),
    }),
  },
};


// single turn executor 
export async function singleTurnExecutor(data: EvalData) {
  const messages = buildMessages(data);
  // set empty toolsets
  const tools: ToolSet = {};

  // look for tools called and return them 
  for (const toolName of data.tools) {
    const def = TOOL_DEFINITIONS[toolName];
    
    // if tools exist put it in toolsets 
    if (def) {
      tools[toolName] = tool({
        description: def.description,
        inputSchema: def.parameters
      }); 
    }
    const result = await generateText({
      model: openai(data.config?.model??"gpt-5-mini"), 
      messages,
      tools,
      stopWhen: stepCountIs(1), 
      temperature: data.config?.temperature?? undefined 
    })

    // extract tools called from result 
    const toolsCall = (result?.toolCalls ?? []).map((tc) => ({
      toolName: tc.toolName,
      args: "args" in tc ? tc.args : {}
    }));
    
    const toolNames = (result?.toolCalls ?? []).map((tc) => ({
    toolName : tc.toolName
  }))
  
    // return 
    return {
      toolsCall,
      toolNames,
      selectedAny: toolNames.length > 0 
    }
  } 
}


export async function multiTurnExecutor(data: MultiTurnEvalData):Promise<MultiTurnResult> {
  const tools = buildMockedTools(data.mockTools);
  // build messages
  const messages: ModelMessage[] = data.messages ?? [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: data.prompt! }
  ];
  
  // generate text : vercel multi-step loop 
  const result = await generateText({
    model: openai(MODEL_NAME),
    messages: messages,
    tools: tools,
    stopWhen: stepCountIs(data.config?.maxSteps ?? 20),
    providerOptions: {
      openai: {
        reasoningEffort: 'high'
      }
    }
  });
  // tools call order 
  let toolsCallOrder: string[] = [];
  // all steps 
  const steps = result.steps.map((step) => {
    const stepToolCalls = (step.toolCalls ?? []).map((tc) => {
      toolsCallOrder.push(tc.toolName);
      return {
        toolName: tc.toolName,
        args: 'args' in tc ? tc.args : {}
      }
    })
    // step toolResults 
    const stepToolResults = (step.toolResults ?? []).map((tr) => ({
      toolName: tr.toolName,
      results: 'results' in tr ? tr.results: {}
    }))

    // return toolscall, result, text for step
    return {
      toolsCall: stepToolCalls.length> 0 ? stepToolCalls: undefined,
      toolsResult: stepToolResults.length> 0? stepToolResults: undefined,
      text: step.text || undefined
    }
  });

  // unique tools use 
  const toolsUsed = [...new Set(toolsCallOrder)]
  
  return {
    text: result.text,
    steps,
    toolCallOrder: toolsCallOrder,
    toolsUsed
  }


}