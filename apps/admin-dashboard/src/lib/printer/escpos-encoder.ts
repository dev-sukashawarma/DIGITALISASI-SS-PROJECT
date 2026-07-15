export class EscPosEncoder {
  private buffer: number[] = [];

  constructor() {
    this.initialize();
  }

  public initialize() {
    this.buffer.push(0x1b, 0x40); // ESC @
    return this;
  }

  public alignLeft() {
    this.buffer.push(0x1b, 0x61, 0x00);
    return this;
  }

  public alignCenter() {
    this.buffer.push(0x1b, 0x61, 0x01);
    return this;
  }

  public alignRight() {
    this.buffer.push(0x1b, 0x61, 0x02);
    return this;
  }

  public bold(on: boolean) {
    this.buffer.push(0x1b, 0x45, on ? 1 : 0);
    return this;
  }

  public size(doubleWidth: boolean, doubleHeight: boolean) {
    let size = 0;
    if (doubleHeight) size |= 0x01;
    if (doubleWidth) size |= 0x10;
    this.buffer.push(0x1d, 0x21, size);
    return this;
  }

  public underline(on: boolean) {
    this.buffer.push(0x1b, 0x2d, on ? 1 : 0);
    return this;
  }

  public text(str: string) {
    for (let i = 0; i < str.length; i++) {
      let code = str.charCodeAt(i);
      if (code > 255) code = 63;
      this.buffer.push(code);
    }
    return this;
  }

  public newline() {
    this.buffer.push(0x0a);
    return this;
  }

  public line(str: string) {
    this.text(str);
    this.newline();
    return this;
  }

  public hr(char = '-', width = 32) {
    this.line(char.repeat(width));
    return this;
  }

  public row(left: string, right: string, char = ' ', width = 32) {
    if (left.length + right.length > width) {
      left = left.substring(0, width - right.length - 1);
    }
    const spacesCount = width - left.length - right.length;
    const middle = char.repeat(Math.max(0, spacesCount));
    this.line(left + middle + right);
    return this;
  }

  public cut(partial = false) {
    this.newline().newline().newline().newline();
    this.buffer.push(0x1d, 0x56, partial ? 0x01 : 0x00);
    return this;
  }

  public encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
