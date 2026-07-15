export class EscPosEncoder {
  private buffer: number[] = [];

  constructor() {
    this.initialize();
  }

  // Basic commands
  public initialize() {
    this.buffer.push(0x1b, 0x40); // ESC @
    return this;
  }

  public alignLeft() {
    this.buffer.push(0x1b, 0x61, 0x00); // ESC a 0
    return this;
  }

  public alignCenter() {
    this.buffer.push(0x1b, 0x61, 0x01); // ESC a 1
    return this;
  }

  public alignRight() {
    this.buffer.push(0x1b, 0x61, 0x02); // ESC a 2
    return this;
  }

  public bold(on: boolean) {
    this.buffer.push(0x1b, 0x45, on ? 1 : 0); // ESC E n
    return this;
  }

  public size(doubleWidth: boolean, doubleHeight: boolean) {
    let size = 0;
    if (doubleHeight) size |= 0x01;
    if (doubleWidth) size |= 0x10;
    this.buffer.push(0x1d, 0x21, size); // GS ! n
    return this;
  }

  public underline(on: boolean) {
    this.buffer.push(0x1b, 0x2d, on ? 1 : 0); // ESC - n
    return this;
  }

  public text(str: string) {
    // Convert string to ASCII (ESC/POS works best with CP437/ASCII by default)
    // For Indonesian we mostly use standard ASCII
    for (let i = 0; i < str.length; i++) {
      let code = str.charCodeAt(i);
      // Fallback non-ascii to ?
      if (code > 255) code = 63;
      this.buffer.push(code);
    }
    return this;
  }

  public newline() {
    this.buffer.push(0x0a); // LF
    return this;
  }

  public line(str: string) {
    this.text(str);
    this.newline();
    return this;
  }

  public hr(char = '-') {
    this.line(char.repeat(32)); // Standard 58mm has 32 chars
    return this;
  }

  // Padding helper: "Left          Right"
  public row(left: string, right: string, char = ' ') {
    const totalLength = 32;
    if (left.length + right.length > totalLength) {
      // If it exceeds, we can truncate the left side or wrap. Let's truncate for now.
      left = left.substring(0, totalLength - right.length - 1);
    }
    const spacesCount = totalLength - left.length - right.length;
    const middle = char.repeat(Math.max(0, spacesCount));
    this.line(left + middle + right);
    return this;
  }

  public cut(partial = false) {
    // Add some empty lines before cutting
    this.newline().newline().newline().newline();
    // GS V m
    this.buffer.push(0x1d, 0x56, partial ? 0x01 : 0x00);
    return this;
  }

  public encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
