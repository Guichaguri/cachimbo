
export interface Logger {
  /**
   * Sends a debug log
   * @param name The cache name
   * @param message The log message
   */
  debug: (name?: string, ...message: any[]) => void;
}
