// for instant env loading
import "dotenv/config";
import { getTracer, Laminar } from "@lmnr-ai/lmnr";
import { streamText, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { SYSTEM_PROMPT } from "./system/prompt.ts";
import type { AgentCallbacks, ToolCallInfo } from "../types.ts";
import { tools } from "./tools/index.ts";
import { executeTools } from "./executeTools.ts";
import { filterCompatibleMessages } from "./system/filterMessages.ts";


// initiliase laminar
Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY,
});

const MODEL_NAME = "gpt-5-mini"; // free gpd  version

export async function runAgent(
  userMessage: string,
  conversationHistory: ModelMessage[],
  callbacks: AgentCallbacks,
) {
  const workingHistory = filterCompatibleMessages(conversationHistory);
  const messages: ModelMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    // compatible working history
    ...workingHistory,
    { role: "user", content: userMessage },
  ];
  //full response
  let fullResponse = "";
  // agent loop
  while (true) {
    const result =  streamText({
      model: openai(MODEL_NAME),
      messages: messages,
      tools,
      system: SYSTEM_PROMPT,
      experimental_telemetry: {
        isEnabled: true,
        tracer: getTracer(),
      },
    });
      
      // initials 
      let toolCalls: ToolCallInfo[] = [];
      let currentText = '';
      let streamError: Error | null = null; 

      // go through every chunk of the stream object 
      try {
          for await (const chunk of result.fullStream) {
              if (chunk.type === 'text-delta') {
                  currentText += chunk.text;
                  callbacks.onToken(chunk.text);  // frontend gets the current stream chunk text
              }
              if (chunk.type === 'tool-call') {
                  const input = 'input' in chunk ? chunk.input: {};
                  toolCalls.push({
                      toolCallId: chunk.toolCallId,
                      toolName: chunk.toolName,
                      args: input as Record<string, unknown>
                  })
                  callbacks.onToolCallStart(chunk.toolName, input);
              }
          }
      } catch (err) {
          const streamError: Error = err as Error; 
          // throw if neither current text nor output is generated 
          if (!currentText || !streamError.message.includes('No output generated')) {
              throw streamError; 
          }
      }

      // full response 
      fullResponse += currentText; 
      //if stream error with no output git ui custom message
      if (streamError || !currentText ) {
      fullResponse = "I apologize, but I wasn't able to generate a response. Could you please try rephrasing your message?";
      callbacks.onToken(fullResponse);
      break;
      }; 

     // if model did not request tool call break 
    const finishReason = await result.finishReason;
    if (finishReason !== "tool-calls" || toolCalls.length === 0) {
      const responseMessages = await result.response;
      messages.push(...responseMessages.messages);
      break;
    }

      // all response messages 
      const responseMessages = await result.response; 
      messages.push(...responseMessages.messages); 
      
      // get all tool calls and return a structure data based on it 
      for (const tc of toolCalls) {
          const result = await executeTools(tc.toolName, tc.args);
          callbacks.onToolCallEnd(tc.toolName, result); 

          // push tool into messages 
          messages.push({
              role: 'tool',
              content: [
                  {
                      type: 'tool-result',
                      toolCallId: tc.toolCallId,
                      toolName: tc.toolName,
                      output: {
                          type: 'text', value: result
                      },
                  },
              ]
          })
      }
  }
    callbacks.onComplete(fullResponse); 
    return messages; 
}

runAgent("What's my name ? ");

