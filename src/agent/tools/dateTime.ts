import { tool } from 'ai'; 
import { z } from 'zod'; 

export const getDateTime = tool({
    description: 'Get current date and time in ISO string format',
    inputSchema: z.object({}), // an empty zod object / could be a full schema,
    execute: async() => {
        return `Current date & time in iso format is : ${new Date().toISOString()}`; 
    }
})