// pages/student-portal.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { parse } from 'cookie';
// Removed axios import as we use fetch within fetchGoogleUser now

// --- Re-introduce fetchGoogleUser Helper (Same as in student-card.js) ---
async function fetchGoogleUser(email) {
  console.log(`[fetchGoogleUser - Portal] Attempting to get refresh token for: ${email}`);
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN, // Critical dependency
      grant_type:    'refresh_token'
    })
  });

  if (!tokenRes.ok) {
      const errorBody = await tokenRes.text();
      console.error(`[fetchGoogleUser - Portal] Failed to refresh Google token: ${tokenRes.status}`, errorBody);
      return null; // Indicate failure
  }

  const { access_token } = await tokenRes.json();
  console.log(`[fetchGoogleUser - Portal] Got new access token. Fetching user data...`);

  const userRes = await fetch(
    // Using projection=full to potentially get more details if needed later
    `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}?projection=full`,
    { headers:{ Authorization:`Bearer ${access_token}` } }
  );

  if (!userRes.ok) {
      const errorBody = await userRes.text();
      console.error(`[fetchGoogleUser - Portal] Failed to fetch Google user data: ${userRes.status}`, errorBody);
      return null; // Indicate failure
  }
  console.log(`[fetchGoogleUser - Portal] Successfully fetched user data.`);
  return await userRes.json();
}

// --- Modify getServerSideProps to fetch Google data ---
export async function getServerSideProps({ req }) {
  console.log("[getServerSideProps - Portal] Starting...");
  const cookies = parse(req.headers.cookie || '');

  const oauthUsername = cookies.oauthUsername || null;
  // *** CRITICAL: Decide the source of truth for Student ID ***
  // Option A: Prioritize fixed ID from cookie (if you set one reliably)
  const studentIdFromCookie = cookies.oauthStudentId || cookies.oauthUserId || null; 
  // Option B: Use Google's unique ID (sub) as the primary ID (requires fetching googleUser first)
  // We'll fetch googleUser anyway for name/email, so let's use Option B logic flow
  
  const oauthFullNameFromCookie = cookies.oauthFullName || null; // Keep as potential fallback
  const trustLevel = parseInt(cookies.oauthTrustLevel || '0', 10);

  console.log("[getServerSideProps - Portal] Cookies parsed:", cookies);

  // Authentication check
  if (!oauthUsername || trustLevel < 3) {
      console.log("[getServerSideProps - Portal] Redirecting: No username or insufficient trust.");
      return { redirect: { destination: '/', permanent: false } };
  }

  // Construct email
  const rawDom = process.env.EMAIL_DOMAIN;
  const domain = rawDom && rawDom.startsWith('@') ? rawDom : '@'+ (rawDom || 'kzxy.edu.kg');
  const studentEmail = oauthUsername.includes('@') ? oauthUsername : `${oauthUsername}${domain}`;

  console.log("[getServerSideProps - Portal] Attempting fetchGoogleUser for:", studentEmail);

  // --- Fetch data from Google ---
  let googleUser;
  let fetchError = null;
  try {
    googleUser = await fetchGoogleUser(studentEmail);
  } catch (error) {
      console.error("[getServerSideProps - Portal] Error during fetchGoogleUser call:", error);
      fetchError = "Failed to communicate with Google services.";
      googleUser = null; // Ensure googleUser is null on error
  }


  // --- Handle Failure to Fetch Google Data ---
  if (!googleUser) {
    console.log("[getServerSideProps - Portal] fetchGoogleUser failed or returned null.");
    // Option: Fallback to cookie data if available, otherwise show error/redirect
    if (studentIdFromCookie && oauthFullNameFromCookie) {
        console.warn("[getServerSideProps - Portal] Falling back to cookie data due to fetch failure.");
        return {
          props: {
            initialFullName: oauthFullNameFromCookie,
            initialEmail: studentEmail, // Still know the email used
            initialStudentId: studentIdFromCookie,
            // Pass an error message indicating data might be stale
            fetchError: "Could not refresh data from Google; showing last known info." 
          }
        };
    } else {
        console.log("[getServerSideProps - Portal] Redirecting: fetchGoogleUser failed and no sufficient cookie fallback.");
        // Redirect if no fallback is possible
        return { redirect: { destination: '/?error=profile_fetch_failed', permanent: false } };
    }
  }

  // --- Extract Data from Google User Object ---
  console.log("[getServerSideProps - Portal] Google user data fetched successfully.");
  // Prioritize Google data
  const fullName = googleUser.name ? `${googleUser.name.familyName || ''}${googleUser.name.givenName || ''}`.trim() : (oauthFullNameFromCookie || 'Name Missing');
  const emailFromGoogle = googleUser.primaryEmail || studentEmail; // Use primaryEmail if available
  
  // *** Student ID Decision Point ***
  // If you have a reliably set FIXED student ID in the cookie (e.g., 'oauthStudentId'), use that.
  // Otherwise, use the Google User ID (googleUser.id which is the 'sub') for consistency.
  const finalStudentId = studentIdFromCookie || googleUser.id || null; // Prioritize cookie ID

  if (!finalStudentId) {
     console.error("[getServerSideProps - Portal] Error: Student ID is missing after Google fetch and cookie check.");
     return { props: { error: "Student ID is missing, cannot display portal." } };
  }
  
  console.log("[getServerSideProps - Portal] Data prepared:", { fullName, emailFromGoogle, finalStudentId });

  // --- Pass fetched data as props ---
  return {
    props: {
      initialFullName: fullName,
      initialEmail: emailFromGoogle,
      initialStudentId: finalStudentId,
      fetchError: null // Indicate successful fetch
    }
  };
}


// --- Modified StudentPortal Component ---
export default function StudentPortal({
    initialFullName,
    initialEmail,
    initialStudentId,
    error, // Error from getServerSideProps (e.g., missing ID)
    fetchError // Error specifically from fetching Google data
}) {
  const router = useRouter();
  const [currentSemester, setCurrentSemester] = useState('');
  const [currentYear, setCurrentYear] = useState('');

  // Calculate semester and year on mount
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    let semesterText = '';
    if (month >= 9 || month <= 2) semesterText = `${year} Fall/Winter`;
    else if (month >= 3 && month <= 8) semesterText = `${year} Spring/Summer`;
    else semesterText = `${year}`;
    setCurrentSemester(semesterText);
    setCurrentYear(year);
  }, []);

  // Delete handler (keep existing)
   const handleDelete = async () => {
    if (!confirm('⚠️ WARNING: Are you sure you want to delete your account?\nThis action is permanent and cannot be undone!')) return;
    
    try {
      const response = await fetch('/api/delete-account', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(`Deletion failed: ${errorData.message || response.statusText}`);
        return;
      }
      
      alert('Account deleted successfully.'); 
      router.push('/api/logout'); 

    } catch (err) {
      console.error("Error deleting account:", err);
      alert('An error occurred while deleting the account.');
    }
  };

  // Handle critical errors from getServerSideProps
   if (error) {
      return (
          <div style={{ padding: '40px', textAlign: 'center', color: 'red', fontFamily: 'Arial, sans-serif' }}>
              <h2>Error Loading Portal</h2>
              <p>{error}</p>
              <a href="/" style={{color: '#007bff', textDecoration: 'underline'}}>Go to Login</a>
          </div>
      );
  }

  return (
    <>
      <Head>
        <title>Student Portal - Confucius Institute</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      </Head>

      <div className="portal-container">
        <header className="portal-header">
          <img src="/images/logo-20th.png" alt="Confucius Institute Logo" className="logo" />
          <h1>孔子学院学生门户</h1>
          <h2>Confucius Institute Student Portal</h2>
        </header>

         {/* Display fetch error if occurred */}
         {fetchError && (
            <div style={{padding: '10px 15px', margin: '0 0 20px 0', background: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', borderRadius: '8px', textAlign: 'center'}}>
                ⚠️ {fetchError}
            </div>
         )}


        <section className="profile-section card">
          <h3><i className="fas fa-user-circle"></i> Student Information</h3>
          <div className="profile-details">
            {/* Display data from props */}
            <p><strong>Name:</strong> <span id="studentName">{initialFullName || 'N/A'}</span></p>
            <p><strong>Semester:</strong> <span id="semester">{currentSemester || 'Calculating...'}</span></p>
            <p><strong>Program:</strong> <span>汉语学习项目</span></p> {/* Static */}
            <p><strong>Student Email:</strong> <span id="studentEmail">{initialEmail || 'N/A'}</span></p>
            <p><strong>Student ID:</strong> <span id="studentID">{initialStudentId || 'N/A'}</span></p>
          </div>
        </section>

        <section className="actions-section card">
          <h3><i className="fas fa-th-large"></i> Quick Access</h3>
          <div className="actions-grid">
            {/* Ensure links use correct data */}
            <a href={`https://mail.google.com/a/${initialEmail?.split('@')[1] || 'kzxy.edu.kg'}?Email=${encodeURIComponent(initialEmail || '')}`} className="action-button email" target="_blank" rel="noopener noreferrer">
              <i className="fas fa-envelope"></i><span>Student Email</span>
            </a>
            <Link href="/student-card" legacyBehavior>
              <a className="action-button card"><i className="fas fa-id-card"></i><span>Student Card</span></a>
            </Link>
            <a href="https://account.adobe.com/" className="action-button adobe" target="_blank" rel="noopener noreferrer">
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Adobe_Express_logo_RGB_1024px.png/500px-Adobe_Express_logo_RGB_1024px.png" alt="Adobe Express" />
              <span>Adobe Express</span>
            </a>
            <Link href="/transcript" legacyBehavior>
              <a className="action-button transcript"><i className="fas fa-file-alt"></i><span>Transcript</span></a>
            </Link>
            <a href="https://www.canva.com/login" className="action-button canva" target="_blank" rel="noopener noreferrer">
               <i className="fas fa-palette"></i><span>Canva</span>
            </a>
            <Link href="/reset-password" legacyBehavior>
              <a className="action-button password"><i className="fas fa-key"></i><span>Reset Password</span></a>
            </Link>
            <Link href="/aliases" legacyBehavior>
              <a className="action-button aliases"><i className="fas fa-plus-circle"></i><span>Add Email Alias</span></a>
            </Link>
          </div>
        </section>

        <footer className="portal-footer">
          <div className="footer-buttons">
            <form action="/api/logout" method="POST" style={{ margin: 0 }}>
              <button type="submit" className="logout-button">
                <i className="fas fa-sign-out-alt"></i> Logout
              </button>
            </form>
            <button type="button" className="delete-button" onClick={handleDelete}>
              <i className="fas fa-trash-alt"></i> Delete Account
            </button>
          </div>
          <div className="footer-text">
            孔子学院学生服务 | Confucius Institute Student Services | Powered by{' '}
            <a href="https://kzxy.edu.kg" target="_blank" rel="noopener noreferrer">kzxy.edu.kg</a>
             | © {currentYear || new Date().getFullYear()}
          </div>
        </footer>
      </div>

      {/* Styles remain the same */}
      <style jsx>{`
        /* === Basic Styles === */
        .portal-container { /* ... */ }
        /* ... (Keep all previous CSS styles) ... */
        .portal-container { max-width: 1000px; margin: 20px auto; padding: 30px; background: white; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); font-family: Arial, sans-serif; line-height: 1.6; }
        .portal-container:hover { box-shadow: 0 15px 40px rgba(0,0,0,0.2); }
        .portal-header, .portal-footer { text-align: center; }
        .logo { width: 90px; height: auto; margin-bottom: 10px; border-radius: 8px; }
        h1 { font-size: 1.6em; margin-bottom: 5px; color: #333; }
        h2 { font-size: 1.1em; color: #555; font-weight: normal; margin-top: 0; margin-bottom: 20px;}
        .card { padding: 20px; background: #f9f9f9; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
        .card h3 { font-size: 1.15em; margin-top: 0; margin-bottom: 18px; color: #333; border-bottom: 1px solid #e8e8e8; padding-bottom: 12px; display: flex; align-items: center; font-weight: 600; }
        .card h3 :global(i) { margin-right: 8px; color: #007bff; }
        .profile-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; }
        .profile-details p { background: #ffffff; padding: 15px; border-radius: 8px; margin: 0; border: 1px solid #eee; transition: background-color 0.2s ease, box-shadow 0.2s ease; text-align: left; font-size: 14px;}
        .profile-details p:hover { background-color: #f0f8ff; box-shadow: 0 2px 5px rgba(0,0,0,0.08); }
        .profile-details p :global(strong) { display: block; font-size: 0.8em; color: #555; margin-bottom: 5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .profile-details p :global(span) { display: block; font-size: 0.95em; color: #0056b3; word-wrap: break-word; }
        .profile-details p :global(span#studentID) { font-family: monospace; color: #dc3545; font-weight: bold; }
        .actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 18px; }
        .action-button { text-align: center; font-weight: 500; font-size: 14px; color: #333; background: #f0f0f0; padding: 18px 10px; border-radius: 10px; text-decoration: none; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 110px; border: 1px solid #e0e0e0; transition: all 0.2s ease-in-out; }
        .action-button:hover { background-color: #007bff; color: white; transform: translateY(-3px) scale(1.03); border-color: #0056b3; box-shadow: 0 5px 15px rgba(0, 123, 255, 0.2); }
        .action-button :global(i), .action-button :global(img) { width: 38px; height: 38px; line-height: 38px; margin-bottom: 10px; color: #007bff; object-fit: contain; transition: color 0.2s ease-in-out; }
        .action-button:hover :global(i) { color: white; }
        .action-button span { line-height: 1.4; }
        .logout-button, .delete-button { margin: 10px 5px; padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s ease, transform 0.15s ease; display: inline-flex; align-items: center; gap: 6px; }
        .logout-button { background: #dc3545; color: white; }
        .logout-button:hover { background: #c82333; transform: scale(1.03); }
        .delete-button { background: #6c757d; color: white; }
        .delete-button:hover { background: #5a6268; transform: scale(1.03); }
        .footer-buttons { display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; margin-bottom: 15px; }
        .footer-text { font-size: 12px; margin-top: 10px; color: #666; }
        .footer-text a { color: #007bff; text-decoration: none; }
        .footer-text a:hover { text-decoration: underline; }

      `}</style>
    </>
  );
}
