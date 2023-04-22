const ESC = '\u001B[';

export const cursorLeft = ESC + 'G';
export const eraseLine = ESC + '2K';
export const cursorBackward = (count = 1): string => ESC + count + 'D';
export const cursorUp = (count = 1): string => ESC + count + 'A';

export const eraseLines = (count: number): string => {
    let clear = '';

    for (let i = 0; i < count; i++) {
        clear += eraseLine + (i < count - 1 ? cursorUp() : '');
    }

    count && (clear += cursorLeft);

    return clear;
};
