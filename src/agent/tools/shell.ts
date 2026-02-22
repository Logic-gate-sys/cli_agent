import { tool } from "ai";
import shell from 'shelljs';
import { z } from 'zod';


export const runCommand = tool({
    description: 'Execute a shell command and return its output, use this for systems operations , running scripts or interacting with the OS ',
    inputSchema: z.object({
        command: z.string().describe('The shell command to execute')
    }),
    execute: async({ command }) => {
        const result = shell.exec(command, { silent: true })
        let output = '';
        // add output to result if any
        if (result.stdout) {
            output += result.stdout; 
        }
        // if and error occurs 
        if (result.stderr) {
            output += result.stderr
        }
        // if execution fails
        if (result.code! == 0) {
            return `Command failed. ${result.code} \n ${result.stdout}`
        }

        // return result 
        return output || 'Command completed successfully with no output';
    }
})