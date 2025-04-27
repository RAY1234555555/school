import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function StudentPortal() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await axios.get('/api/profile');
        setProfile(response.data);
      } catch (error) {
        router.push('/');
      }
    }

    fetchProfile();
  }, [router]);

  if (!profile) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '50px' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <img 
          src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png" 
          alt="Confucius Institute Logo"
          style={{ width: '100px', height: 'auto', marginBottom: '10px' }}
        />
        <h1>Confucius Institute - 孔子学院 Student Portal</h1>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <p><strong>Name:</strong> {profile.name}</p>
        <p><strong>Semester:</strong> {profile.semester}</p>
        <p><strong>Program:</strong> {profile.program}</p>
        <p><strong>Student Email:</strong> {profile.student_email}</p>
        <p><strong>Personal Email:</strong> {profile.personal_email}</p>
        <p><strong>Student ID:</strong> {profile.student_id}</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px' }}>
        <a href="https://mail.google.com" target="_blank" rel="noopener noreferrer">
          <button>Student Email</button>
        </a>
        <a href="/student-card">
          <button>e-Student Card</button>
        </a>
        <a href="https://express.adobe.com/" target="_blank" rel="noopener noreferrer">
          <button>Adobe Express</button>
        </a>
        <a href="/transcript">
          <button>Transcript</button> {/* 新增的成绩单按钮 */}
        </a>
        <a href="https://www.canva.com/" target="_blank" rel="noopener noreferrer">
          <button>Canva</button>
        </a>
        <a href="/reset-password">
          <button>Reset Password</button>
        </a>
      </div>

      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <form action="/api/logout" method="POST">
          <button style={{ backgroundColor: 'red', color: 'white', padding: '10px 20px', borderRadius: '5px', border: 'none' }}>
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}
