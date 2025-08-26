export const distance = (e1, e2) => {
    return Math.sqrt((e1.x - e2.x) ** 2 + (e1.y - e2.y) ** 2);
};

export const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
};