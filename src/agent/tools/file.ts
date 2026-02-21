import fs from 'node:fs/promises';
import nodePath from 'node:path'
import { tool } from 'ai'; 
import { z } from 'zod';
import { features } from 'node:process';
import { describe } from 'zod/v4/core';


export const readFile = tool({
    description: 'Read file at a given path and output the contents of the file',
    inputSchema: z.object({
        path: z.string().describe(' path of the file th read')
    }),
    execute: async ({ path }) => {
        try {
            const content = await fs.readFile(path, 'utf-8');
            return content;
        } catch (err) {
            return `There was an error reading the file. Here is the error from node: ${err}`;
        }
    }
}); 

export const writeFile = tool({
    description: 'Write content to a file at a specified given path, create a file if it does not exist or override a file if it exists',
    inputSchema: z.object({
        path: z.string().describe('Path to the to file to write to'),
        content:z.string().describe('Content to write to a file')
    }),
    execute: async ({ path, content }) => {
        try {
            const dir = nodePath.dirname(path);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(dir, content, 'utf-8'); 
            return `File created succesfull with ${content.length} characters to ${path}
            Note: You should verify by listing files `
        } catch (err) {
            return `Not able to write to that file at that path here is the nodejs error: ${err}.
            You should figure out from the Nodejs docs on why this error`;
        }
    }
})

export const listFiles = tool({
    description: 'List files at the specify directory path',
    inputSchema: z.object({
        directory: z.string().describe('The directory path to list the content of ').default('.')
    }),
    execute: async ({ directory }) => {
        try {
            const entries = await fs.readdir(directory, { withFileTypes: true });
            const items = entries.map((entry) => {
                const type = entry.isDirectory() ? ['dir'] : ['file']
                return `${type} ${entry.name}`
            });
            return items.length > 0 ? items.join('/n') : `Directory ${directory} is empty`
        } catch (err) {
            return `Could not list contents in this directory , here is the nodejs error : ${err}`
        }
    }
});


export const deleteFile = tool({
    description: 'Delete a file at a given path: USE WITH CAUTION - This is very irreversible',
    inputSchema: z.object({
        path: z.string().describe('Path to the file to you want to delete')
    }),
    execute: async({ path }) => {
        try {
            await fs.unlink(path);
            return `Successfully deleted the file at : ${path}`
        } catch (err) {
            return `Could not delete that file : here is the nodejs error: ${err}`
        }
    }
})
