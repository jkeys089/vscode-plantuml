import * as vscode from 'vscode';
import { formatRules } from './rulesWriting';
import { ElementType, Rule, Capture } from './rules';
import { MatchPositions, UnmatchedText } from './matchPositions';
import { config } from '../config';
import { outputPanel } from '../planuml';
import { showError, parseError } from '../tools';
import { MultiRegExp2, MultiRegExMatch } from './multiRegExp2';
import { Analyst } from './analyst';

interface Line {
    text: string,
    newText: string,
    matchPositions: MatchPositions,
    elements: Elemet[]
}
interface Elemet {
    type: ElementType,
    text: string,
    start: number,
    end: number
}
class Formatter implements vscode.DocumentFormattingEditProvider {
    public provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        try {
            return this.formate(document, options, token);
        } catch (error) {
            showError(outputPanel, parseError(error));
        }
    }
    register(): vscode.Disposable[] {
        let ds: vscode.Disposable[] = [];
        let d = vscode.languages.registerDocumentFormattingEditProvider(
            <vscode.DocumentFilter>{ language: "diagram" },
            this
        );
        ds.push(d);
        return ds;
    }
    private blocks: Rule[] = [];
    formate(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.TextEdit[] {
        let edits: vscode.TextEdit[] = [];
        this.blocks = [];
        const spaceStr = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
        let lineTexts: string[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            lineTexts.push(document.lineAt(i).text);
        }
        let lines = new Analyst(lineTexts, formatRules);
        lines.analysis();

        return edits;
    }


    private indent(lineText: string, spaceStr: string, level: number): string {
        if (!lineText.trim()) return "";
        level = level < 0 ? 0 : level;
        return spaceStr.repeat(level) + lineText.trim();
    }
    private formatLine(line: Line) {
        if (line.text.trim() && !line.elements.length)
            throw ("no element found for a non-empty line!");
        if (!line.elements.length) {
            line.newText = "";
            return;
        }
        let text = getElementText(line.elements[0]);
        // let formatType: FormatType;
        for (let i = 0; i < line.elements.length - 1; i++) {
            let thisEl = line.elements[i];
            let nextEl = line.elements[i + 1];
            switch (thisEl.type) {
                case ElementType.none:
                case ElementType.word:
                    switch (nextEl.type) {
                        case ElementType.none:
                        case ElementType.punctLeftSpace:
                        case ElementType.operater:
                        case ElementType.word:
                            text += " " + getElementText(nextEl);
                            break;
                        default:
                            text += getElementText(nextEl);
                            break;
                    }
                    break;
                case ElementType.operater:
                case ElementType.punctRightSpace:
                    switch (nextEl.type) {
                        case ElementType.none:
                        case ElementType.word:
                        case ElementType.punctLeftSpace:
                            text += " " + getElementText(nextEl);
                            break;
                        default:
                            text += getElementText(nextEl);
                            break;
                    }
                    break;
                case ElementType.punctLeftSpace:
                    text += getElementText(nextEl);
                    break;
                case ElementType.connector:
                    text += getElementText(nextEl);
                    break;
                default:
                    text += getElementText(nextEl);
                    break;
            }
        }
        line.newText = text;
        function getElementText(el: Elemet): string {
            if (el.type == ElementType.asIs) return el.text;
            return el.text.trim();
        }
    }
    private makeLineElements(line: Line) {
        if (line.elements.length) line.elements.sort((a, b) => a.start - b.start);
        let pos = 0;
        let els: Elemet[] = [];
        for (let e of line.elements) {
            if (e.start > pos && line.text.substring(pos, e.start).trim()) els.push({
                type: ElementType.none,
                text: line.text.substring(pos, e.start),
                start: pos,
                end: e.start - 1
            });
            pos = e.end + 1;
        }
        if (pos < line.text.length && line.text.substring(pos, line.text.length).trim()) {
            els.push({
                type: ElementType.none,
                text: line.text.substring(pos, line.text.length),
                start: pos,
                end: line.text.length - 1
            });
        }
        line.elements.push(...els);
        if (line.elements.length) line.elements.sort((a, b) => a.start - b.start);
    }
}

export const formatter = new Formatter();