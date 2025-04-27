import cookie from 'cookie';

export default function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');

  const fullName = cookies.oauthUsername || '';
  const email = cookies.oauthEmail || '';
  const personalEmail = cookies.oauthPersonalEmail || '';
  let studentId = cookies.oauthStudentId || '';

  if (!studentId) {
    studentId = Math.floor(10000000 + Math.random() * 90000000).toString();
    res.setHeader('Set-Cookie', [`oauthStudentId=${studentId}; Path=/; HttpOnly`]);
  }

  const [familyName = '', givenName = ''] = fullName.length > 1 ? [fullName[0], fullName.slice(1)] : ['', ''];

  const currentMonth = new Date().getMonth() + 1;
  const semester = currentMonth >= 1 && currentMonth <= 6 ? 'Spring' : 'Fall';

  res.status(200).json({
    name: {
      familyName,
      givenName
    },
    semester: `${semester} ${new Date().getFullYear()}`,
    program: 'Chinese Language Studies',
    student_email: email,
    personal_email: personalEmail,
    student_id: studentId
  });
}
