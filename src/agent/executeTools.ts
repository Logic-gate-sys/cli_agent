import type { ZodNonEmptyArray } from 'zod/v3';
import { tools } from './tools/index.ts'; 

export type ToolName = keyof typeof tools; 

export const executeTools = async (name: string, args: any): Promise<string> => {
    const tool = tools[name as ToolName]; 
    if (!tool) {
        return 'Unknown tool' 
    }
    // execute function on tool
    const execute = tool.execute; 
    if (!execute) {
        return `Provider tool ${name} - Executed by model provider`
    }
    //tool execuation result 
    const executionResult = await execute(args as any, {
        // sdk-require arguments 
        toolCallId: '', // id given to the tool by provider
        messages: []
    });

    // return result as string: LLMs understand string (language only) 
    return String(executionResult); 
}