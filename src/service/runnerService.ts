import { resolve as res } from 'path';
import * as vscode from 'vscode';
import { CodeUtil } from '../common/codeUtil';
import { FileManager, FileModel } from '../common/fileManager';
import { ConfigKey, Global } from '../common/global';
import { Process } from '../common/processWrapper';
import * as fs from 'fs'; // In NodeJS: 'const fs = require('fs')'

export class RunnerService {
    /** Runs the editor selection as a standalone script. */
    public static async runSelection(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found!');
            return;
        }

        var selection = editor.selection;
        var text = editor.document.getText(selection);
        this.run(await this.createTemplate(text));
    }

    public static async startDebugger(script?: string) {
        const cwd = script
            ? vscode.Uri.file(script)
            : vscode.window.activeTextEditor.document.uri;
        script = script ? script : await this.getPathByActive();
        const debugPlusExists = vscode.extensions.getExtension(
            'zero-plusplus.vscode-autohotkey-debug',
        );
        vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(cwd), {
            type: debugPlusExists ? 'autohotkey' : 'ahk',
            request: 'launch',
            name: 'AutoHotkey Debugger',
            runtime: Global.getConfig<string>(ConfigKey.executePath),
            program: script,
        });
    }

    /**
     * Runs the script at the specified path
     */
    public static async run(path?: string): Promise<void> {
        const executePath = Global.getConfig(ConfigKey.executePath);
        this.checkAndSaveActive();
        if (!path) {
            path = await this.getPathByActive();
        }
        Process.exec(`\"${executePath}\" \"${path}\"`, {
            cwd: `${res(path, '..')}`,
        });
    }

    /**
     * Build compile command
     * @param compilePath Compiler path
     * @param scriptPath Script path
     * @param showGui Flag to show compiler GUI
     * @returns Compile command
     */
    public static compileCommand(
        compilePath: string,
        scriptPath: string,
        showGui: boolean,
    ) {
        if (!compilePath || !scriptPath) {
            return '';
        }
        const pos = scriptPath.lastIndexOf('.');
        const exePath =
            scriptPath.substring(0, pos < 0 ? scriptPath.length : pos) + '.exe';
        const guiKey = showGui ? ' /gui' : '';
        const compileCommand = `"${compilePath}"${guiKey} /in "${scriptPath}" /out "${exePath}"`;
        return compileCommand;
    }

    /**
     * Compiles current script
     */
    public static async compile(showGui: boolean) {
        const currentPath = vscode.window.activeTextEditor.document.uri.fsPath;
        if (!fs.existsSync(currentPath)) {
            vscode.window.showErrorMessage('Cannot compile never-saved files.');
            return;
        }
        this.checkAndSaveActive();
        const command = this.compileCommand(
            Global.getConfig(ConfigKey.compilePath),
            currentPath,
            showGui,
        );
        if (!command) {
            vscode.window.showErrorMessage('Cannot build compile command.');
            return;
        }
        if (
            (await Process.exec(command, {
                cwd: `${res(currentPath, '..')}`,
            })) &&
            !showGui
        ) {
            vscode.window.showInformationMessage('Compile success!');
        }
    }

    public static async getPathByActive(): Promise<string> {
        const document = vscode.window.activeTextEditor.document;
        if (document.isUntitled) {
            return await this.createTemplate(document.getText());
        }
        return document.fileName;
    }

    public static async createTemplate(content: string) {
        const path = `temp-${this.getNowDate()}.ahk`;
        return await FileManager.record(path, content, FileModel.write);
    }

    private static checkAndSaveActive(): void {
        if (!vscode.window.activeTextEditor.document.isUntitled) {
            vscode.commands.executeCommand('workbench.action.files.save');
        }
    }

    private static getNowDate(): string {
        const date = new Date();
        let month: string | number = date.getMonth() + 1;
        let strDate: string | number = date.getDate();

        if (month <= 9) {
            month = '0' + month;
        }

        if (strDate <= 9) {
            strDate = '0' + strDate;
        }

        return (
            date.getFullYear() +
            '-' +
            month +
            '-' +
            strDate +
            '-' +
            this.pad(date.getHours(), 2) +
            '-' +
            this.pad(date.getMinutes(), 2) +
            '-' +
            this.pad(date.getSeconds(), 2)
        );
    }

    private static pad(n: any, width: number, z?: any): number {
        z = z || '0';
        n = n + '';
        return n.length >= width
            ? n
            : new Array(width - n.length + 1).join(z) + n;
    }
}
