const defaultFields = {
    success: 0,
    failed: 0
};
export const updateTitle = (type: 'success' | 'failed'): void => {
    defaultFields[type] += 1;

    process.title = `STACKER v0.0.5 |    Success: ${defaultFields.success}   |   Failed: ${defaultFields.failed}`;
};
