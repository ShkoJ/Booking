const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();
    
    const { email, details, type } = req.body;
    const transporter = nodemailer.createTransporter({
        service: 'outlook',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
    });

    const subject = type === '15min' ? '⏰ Meeting in 15 Minutes!' : '✅ Meeting Booked!';
    const html = type === '15min' ? 
        `<h2>⏰ Your meeting starts in 15 minutes!</h2><p><strong>${details}</strong></p>` :
        `<h2>✅ Meeting Confirmed!</h2><p><strong>${details}</strong></p>`;

    try {
        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: email,
            subject, html
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};