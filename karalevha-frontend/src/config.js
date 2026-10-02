export const API_URL = process.env.REACT_APP_API_URL || "https://karalevha.onrender.com";

export const parseUTC = (dateStr) => {
    if (!dateStr) return new Date();
    let s = dateStr.toString();
    if (!s.endsWith('Z') && !s.includes('+')) {
        s += 'Z';
    }
    return new Date(s);
};
