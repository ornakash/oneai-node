import * as path from 'path';
import * as fs from 'fs';
import parseConversation from './parsing';
import type { OutputFields } from './skills';

export interface Skill {
  apiName: string
  isGenerator?: boolean
  params?: object
  labelType?: string
  outputField?: string
  outputField1?: string
}

export type inputType = 'article' | 'conversation' | undefined;
export type encoding = 'utf8' | 'base64';

export type FileContent = {
  filePath: string,
  buffer: Buffer,
};
export type ConversationContent = {
  speaker: string,
  utterance: string,
}[];

export type TextContent = string | ConversationContent | FileContent;

export function isInput(object: any): object is Input {
  return typeof object === 'object' && 'text' in object;
}

export function isFileContent(object: any): object is FileContent {
  return typeof object === 'object' && 'filePath' in object && 'buffer' in object;
}

export interface _Input<T extends TextContent> {
  text: T;
  type?: inputType;
  contentType?: string;
  encoding?: encoding;
  metadata?: any;
}

export type Input = _Input<TextContent>;

export class Document implements _Input<string> {
  type: inputType = 'article';

  text: string;

  constructor(text: string) {
    this.text = text;
  }
}

export interface Utterance {
  speaker: string,
  utterance: string
}

export class Conversation implements _Input<ConversationContent> {
  type: inputType = 'conversation';

  contentType: string = 'application/json';

  text: ConversationContent;

  constructor(utterances: ConversationContent) {
    this.text = utterances;
  }

  get utterances(): ConversationContent {
    return this.text;
  }

  set utterances(utterances: ConversationContent) {
    this.text = utterances;
  }

  static parse(text: string): Conversation {
    return new Conversation(parseConversation(text));
  }
}

interface ExtInfo {
  contentType: string,
  type: inputType,
  isBinary: boolean,
}

const extensions: Record<string, ExtInfo> = {
  '.json': {
    contentType: 'application/json',
    type: 'conversation',
    isBinary: false,
  },
  '.txt': {
    contentType: 'text/plain',
    type: 'article',
    isBinary: false,
  },
  '.srt': {
    contentType: 'text/plain',
    type: 'conversation',
    isBinary: false,
  },
  '.mp3': {
    contentType: 'audio/mp3',
    type: 'conversation',
    isBinary: true,
  },
  '.wav': {
    contentType: 'audio/wav',
    type: 'conversation',
    isBinary: true,
  },
  '.html': {
    contentType: 'text/plain',
    type: 'article',
    isBinary: false,
  },
};

export class File implements _Input<FileContent> {
  type: inputType;

  contentType?: string;

  encoding: encoding;

  text: FileContent;

  constructor(fileContent: string | FileContent, inputType?: inputType) {
    this.type = inputType;

    this.text = typeof fileContent === 'string'
      ? { filePath: fileContent, buffer: fs.readFileSync(fileContent) } : fileContent;
    const input = wrapContent(this.text);
    this.type = input.type;
    this.contentType = input.contentType;
    this.encoding = input.encoding as encoding;
  }

  read(): Input {
    return {
      text: this.text.buffer.toString(this.encoding),
      encoding: this.encoding,
      contentType: this.contentType,
      type: this.type,
    };
  }
}

export function wrapContent<T extends TextContent>(
  content: _Input<T> | T,
): _Input<T> {
  if (isInput(content)) return content;
  if (typeof content === 'string') {
    return {
      text: content,
      type: 'article',
    };
  }
  if (isFileContent(content)) {
    const ext = path.extname(content.filePath);
    if (!(ext in extensions)) throw new Error(`Unsupported file type: ${ext}`);
    const { contentType, type, isBinary } = extensions[ext];

    return {
      text: content,
      encoding: (isBinary) ? 'base64' : 'utf8',
      contentType,
      type,
    };
  }
  return {
    text: content,
    type: 'conversation',
    contentType: 'application/json',
  };
}

interface Span {
  start: number,
  end: number,
  section: number,
}

export interface Label {
  type: string
  name: string
  /** @deprecated since version 0.2.0, use `outputSpans` instead */
  span: number[]
  span_text: string
  outputSpans: Span[]
  inputSpans: Span[]
  value: number | string
  data: object
  timestamp?: number
  timestampEnd?: number
}

export interface Output extends Input, OutputFields {
  text: TextContent
  [key: string]: (Output | Label[] | TextContent | any)
}
