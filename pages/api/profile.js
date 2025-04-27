// === 文件 1：pages/api/profile.js ===

import cookie from 'cookie';

export default function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');

  const fullName = cookies.oauthUsername || '测试用户';
  const email = cookies.oauthEmail || 'test@example.com';
  const personalEmail = cookies.oauthPersonalEmail || '';
  const studentId = cookies.oauthStudentId || '00000000';

  const [familyName = '', givenName = ''] = fullName.length > 1 ? [fullName[0], fullName.slice(1)] : ['姓', '名'];

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
