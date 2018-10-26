export function SecureEndpoint() {
    return function <T extends { new(...args: any[]): { secureEndpoint(): void } }>(constructor: T) {
        return class extends constructor {
            constructor(...args: any[]) {
                super(...args);
                this.secureEndpoint();
            }
        }
    }
}