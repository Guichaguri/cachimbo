
export interface Logger {
  warn: (...message: any[]) => void;
  debug: (...message: any[]) => void;
}
