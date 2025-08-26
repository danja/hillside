export const getCanvasMousePosition = (canvas, event) => {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
};

export const resizeCanvas = (canvas, body) => {
    const width = body.clientWidth;
    const height = body.clientHeight;
    canvas.width = width;
    canvas.height = height;
    return { width, height };
};