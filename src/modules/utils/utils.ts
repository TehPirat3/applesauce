export const proxyParser = (proxy: string): string => {
    const [ip, port, user, pass] = proxy.split(':');
    return `http://${user}:${pass}@${ip}:${port}`;
};
export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
