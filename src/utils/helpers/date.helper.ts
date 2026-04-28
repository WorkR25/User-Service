export function formatter(date: Date) {
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    });

    return formattedDate;
}