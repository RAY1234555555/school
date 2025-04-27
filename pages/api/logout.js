// /pages/api/logout.js

export default function handler(req, res) {
  if (req.method === 'POST') {
    // 这里只需要清除cookie，比如叫 token / session
    res.setHeader('Set-Cookie', 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    res.status(200).json({ message: 'Logout successful' });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
