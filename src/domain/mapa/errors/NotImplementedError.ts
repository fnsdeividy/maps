export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} ainda não foi implementado.`);
    this.name = "NotImplementedError";
  }
}
