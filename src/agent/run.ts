// for instant env loading
import 'dotenv/config'
import { getTracer, Laminar } from '@lmnr-ai/lmnr';
import { generateText, type ModelMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { SYSTEM_PROMPT } from './system/prompt.ts';
import type { AgentCallbacks } from '../types.ts';
import { tools } from './tools/index.ts';
import { executeTools } from './executeTools.ts';


// initiliase laminar 
Laminar.initialize({
    projectApiKey: process.env.LMNR_PROJECT_API_KEY
})

const MODEL_NAME = 'gpt-5-mini'; // free gpd  version 
async function runAgent(userMessage: string, conversationHistory: ModelMessage[], callbacks: AgentCallbacks) {
    const { text, toolCalls } = await generateText({
        model: openai(MODEL_NAME),
        prompt: userMessage,
        system: SYSTEM_PROMPT,
        // tools the agent is exposed to 
        tools: tools,
        toolChoice: 'auto',

        //OPEN TELEMETRY FOR TRACING 
        experimental_telemetry: {
            isEnabled: true,
            tracer: getTracer()
        }
    }); 
    // if any tools is called then toolsCall will be returned rather than text
    toolCalls.forEach(async (tc) => {
        console.log(await executeTools(tc.toolName, tc.input))
    });
    
    // flush 
    await Laminar.flush(); 
    // log text and tools 
    console.log(text, toolCalls); 
}

// call agent 
runAgent("What's my name ? "); 