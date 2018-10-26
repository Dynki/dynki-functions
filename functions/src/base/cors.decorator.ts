export function EnableCors() {
    return function <T extends { new (...args: any[]): { enableCors(): void } }>(constructor: T) {
        return class extends constructor {
            constructor(...args: any[]) {
                super(...args);
                this.enableCors();
            }
        }
    }
}