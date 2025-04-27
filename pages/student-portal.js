// /pages/student-portal.js

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function StudentPortal() {
  const [studentInfo, setStudentInfo] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) {
          throw new Error('Failed to fetch profile');
        }
        const data = await res.json();
        setStudentInfo(data);
      } catch (error) {
        console.error(error);
        router.push('/'); // 如果未登录，跳回首页
      }
    }

    fetchProfile();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  if (!studentInfo) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Confucius Institute - Student Portal</h1>
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Name:</strong> {studentInfo.name}</p>
        <p><strong>Semester:</strong> {studentInfo.semester}</p>
        <p><strong>Program:</strong> {studentInfo.program}</p>
        <p><strong>Student Email:</strong> {studentInfo.studentEmail}</p>
        <p><strong>Personal Email:</strong> {studentInfo.personalEmail}</p>
        <p><strong>Student ID:</strong> {studentInfo.studentID}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => router.push('/student-card')}>e-Student Card</button>
        <button onClick={() => router.push('/transcript')}>Transcript</button>
      </div>

      <button onClick={handleLogout} style={{ backgroundColor: 'red', color: 'white' }}>
        Logout
      </button>
    </div>
  );
}
