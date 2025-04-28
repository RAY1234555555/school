// pages/transcript.js
import Head from 'next/head';
import Script from 'next/script'; // Keep for JsBarcode
import { useEffect, useState, useCallback } from 'react';
import { parse } from 'cookie';
import { DateTime } from 'luxon';

// --- fetchGoogleUser Helper (Remains the same) ---
async function fetchGoogleUser(email) {
    console.log(`[fetchGoogleUser - Transcript] Attempting for: ${email}`);
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
        console.error("[fetchGoogleUser - Transcript] Missing Google OAuth ENV VARS!");
        return null;
    }
    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', { /* ... options ... */ 
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
                grant_type: 'refresh_token'
            })
        });
        if (!tokenRes.ok) { const errorBody = await tokenRes.text(); console.error(`[fetchGoogleUser - Transcript] Token Refresh Fail: ${tokenRes.status}`, errorBody); return null; }
        const { access_token } = await tokenRes.json();
        console.log(`[fetchGoogleUser - Transcript] Token OK. Fetching user...`);
        const userRes = await fetch( `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}?projection=full`, { headers: { Authorization: `Bearer ${access_token}` } });
        if (!userRes.ok) { const errorBody = await userRes.text(); console.error(`[fetchGoogleUser - Transcript] User Fetch Fail: ${userRes.status}`, errorBody); return null; }
        console.log(`[fetchGoogleUser - Transcript] User OK.`);
        return await userRes.json();
    } catch (error) { console.error("[fetchGoogleUser - Transcript] Network/Other Error:", error); return null; }
}

// --- getServerSideProps (Remains the same) ---
export async function getServerSideProps({ req }) {
    console.log("[getServerSideProps - Transcript] Starting...");
    const cookies = parse(req.headers.cookie || '');
    const oauthUsername = cookies.oauthUsername || null;
    const studentIdFromCookie = cookies.oauthStudentId || cookies.oauthUserId || null;
    const oauthFullNameFromCookie = cookies.oauthFullName || null;
    const trustLevel = parseInt(cookies.oauthTrustLevel || '0', 10);

    console.log("[getServerSideProps - Transcript] Cookies:", cookies);

    if (!oauthUsername || trustLevel < 3) {
        console.log("[getServerSideProps - Transcript] Redirect: Auth Fail.");
        return { redirect: { destination: '/', permanent: false } };
    }

    const rawDom = process.env.EMAIL_DOMAIN;
    const domain = rawDom && rawDom.startsWith('@') ? rawDom : '@' + (rawDom || 'kzxy.edu.kg');
    const studentEmail = oauthUsername.includes('@') ? oauthUsername : `${oauthUsername}${domain}`;

    console.log("[getServerSideProps - Transcript] Fetching Google User:", studentEmail);
    const googleUser = await fetchGoogleUser(studentEmail);

    let fullName, emailToUse, finalStudentId, fetchError = null;

    if (!googleUser) {
        console.warn("[getServerSideProps - Transcript] Fetch Fail. Fallback.");
        fetchError = "Could not refresh data from Google.";
        fullName = oauthFullNameFromCookie;
        emailToUse = studentEmail;
        finalStudentId = studentIdFromCookie;
    } else {
        console.log("[getServerSideProps - Transcript] Fetch OK.");
        fullName = googleUser.name ? `${googleUser.name.givenName || ''} ${googleUser.name.familyName || ''}`.trim() : oauthFullNameFromCookie;
        emailToUse = googleUser.primaryEmail || studentEmail;
        finalStudentId = studentIdFromCookie || googleUser.id;
    }

    if (!finalStudentId) { console.error("[getServerSideProps - Transcript] Error: ID Missing."); return { props: { error: "Student ID missing." } }; }
    if (!fullName) { fullName = "Student"; }

    console.log("[getServerSideProps - Transcript] Props Data:", { fullName, emailToUse, finalStudentId });

    return { props: { fullName, studentEmail: emailToUse, studentId: finalStudentId, error: null, fetchError } };
}


// --- Transcript Component (PDF Removed) ---
export default function Transcript({
    fullName,
    studentEmail,
    studentId,
    error,
    fetchError
}) {
    // State remains the same, except for pdf generation state
    const [coursesData, setCoursesData] = useState({ selectedCourses: [], totalAttempted: 0, totalEarned: 0, totalQualityPoints: 0, gpa: '0.00' });
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [printDate, setPrintDate] = useState('');
    const [transcriptNo, setTranscriptNo] = useState('');

    // Helpers remain the same
    const seededRandom = useCallback((seed) => { /* ... */ const x = Math.sin(seed)*10000; return x - Math.floor(x); }, []);
    const generateRandomDOB = useCallback((seed) => { /* ... */ const random = (offset) => seededRandom(seed+offset); const baseYear=1998+Math.floor(random(50)*8); const m=Math.floor(random(51)*12); const d=1+Math.floor(random(52)*27); const dob=new Date(baseYear,m,d); return dob.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}); }, [seededRandom]);
    const generateCoursesData = useCallback((studentIdSeed) => { /* ... (same generation logic) ... */ 
        const coursePool = [ { id: 'CHN101', title: 'Elementary Chinese Speaking', credits: 3.0 }, { id: 'CHN102', title: 'Elementary Chinese Reading', credits: 3.0 }, { id: 'CHN201', title: 'Intermediate Chinese Speaking', credits: 3.0 }, { id: 'CHN202', title: 'Intermediate Chinese Reading', credits: 3.0 }, { id: 'CHN301', title: 'Advanced Chinese Grammar', credits: 3.0 }, { id: 'CUL100', title: 'Chinese Culture and Society', credits: 3.0 }, { id: 'CUL110', title: 'Chinese Festivals and Customs', credits: 2.0 }, { id: 'CUL200', title: 'Ancient Chinese Literature', credits: 3.0 }, { id: 'CUL210', title: 'Chinese Philosophy Introduction', credits: 3.0 }, { id: 'CUL220', title: 'Chinese Traditional Medicine', credits: 2.0 }, { id: 'CUL230', title: 'Chinese Martial Arts', credits: 1.0 }, { id: 'CUL240', title: 'Chinese Painting Basics', credits: 1.0 }, { id: 'CUL250', title: 'Chinese Folk Arts', credits: 1.0 }, { id: 'CUL260', title: 'Chinese Film and Media', credits: 3.0 }, { id: 'BUS300', title: 'Business Chinese', credits: 3.0 }, { id: 'HIS100', title: 'Chinese History Overview', credits: 3.0 }, { id: 'GEO100', title: 'Chinese Geography', credits: 3.0 }, { id: 'LAW100', title: 'Chinese Politics and Law', credits: 3.0 }, { id: 'ECO100', title: 'Chinese Economic Development', credits: 3.0 }, { id: 'LIT400', title: 'Modern Chinese Literature', credits: 3.0 }, ];
        const grades = ['A', 'A-', 'B+', 'B', 'C+', 'C', 'W']; const gpaPoints = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'C+': 2.3, 'C': 2.0, 'W': 0 };
        const seed = parseInt(studentIdSeed, 10) || Math.floor(Math.random() * 100000); const random = (offset) => seededRandom(seed + offset);
        const selectedCourses = []; let totalAttempted = 0, totalEarned = 0, totalQualityPoints = 0;
        const terms = []; const currentJsDate = new Date(); const currentYear = currentJsDate.getFullYear(); const currentMonth = currentJsDate.getMonth() + 1; const academicYearStartMonth = 9; let currentTermYear = currentYear; let currentTermSeason = (currentMonth >= academicYearStartMonth || currentMonth <= 2) ? 'Fall' : 'Spring'; if (currentMonth <= 2) currentTermYear--; const startYear = 2023; const startSeason = 'Fall'; for (let year = startYear; year <= currentTermYear; year++) { if (year === startYear && startSeason === 'Spring') {} else { terms.push(`Fall ${year}`); if (year < currentTermYear || (year === currentTermYear && currentTermSeason === 'Spring')) { terms.push(`Spring ${year + 1}`); } } if (year === currentTermYear && `Fall ${year}` === `${currentTermSeason} ${currentTermYear}`) break; if (year + 1 === currentTermYear && `Spring ${year + 1}` === `${currentTermSeason} ${currentTermYear}`) break; }
        const coursesPerTerm = 4; const usedIndices = new Set();
        terms.forEach((term, termIndex) => { const termCourses = []; let termAttempt = 0; while (termCourses.length < coursesPerTerm && usedIndices.size < coursePool.length && termAttempt < coursePool.length * 2) { const courseIdx = Math.floor(random(termIndex * 100 + termCourses.length * 5 + termAttempt) * coursePool.length); termAttempt++; if (!usedIndices.has(courseIdx)) { usedIndices.add(courseIdx); const course = coursePool[courseIdx]; const gradeRoll = random(termIndex * 100 + termCourses.length * 5 + 1); const gradeIdx = Math.floor(gradeRoll * (grades.length - (gradeRoll < 0.05 ? 0 : 1) )); const grade = grades[gradeIdx]; const credit = course.credits; const isEarned = grade !== 'W'; const qualityPts = isEarned ? (credit * (gpaPoints[grade] || 0)) : 0; termCourses.push({ term, courseId: course.id, title: course.title, grade, credit }); totalAttempted += credit; if (isEarned) { totalEarned += credit; totalQualityPoints += qualityPts; } } } if(termCourses.length > 0){ selectedCourses.push({ term, courses: termCourses }); } });
        const gpa = totalEarned > 0 ? (totalQualityPoints / totalEarned).toFixed(2) : '0.00';
        return { selectedCourses, totalAttempted, totalEarned, totalQualityPoints, gpa };
     }, [seededRandom]);

    // useEffect remains the same
    useEffect(() => {
        if (studentId && studentId !== 'ERRORID') {
            const dobSeed = parseInt(studentId, 10) || 12345;
            setDateOfBirth(generateRandomDOB(dobSeed));
            setCoursesData(generateCoursesData(studentId));
            const now = DateTime.now().setZone('America/New_York');
            setPrintDate(now.toFormat('MMMM dd, yyyy'));
            setTranscriptNo(`Transcript No. ${now.toFormat('yyyyMMdd')}-${studentId}`);
        } else {
            // Set defaults if ID is missing
             setDateOfBirth('N/A');
             setCoursesData({ selectedCourses: [], totalAttempted: 0, totalEarned: 0, totalQualityPoints: 0, gpa: 'N/A' });
             setPrintDate('N/A');
             setTranscriptNo('Transcript No. N/A');
        }
    }, [studentId, generateRandomDOB, generateCoursesData]);

    // --- Removed PDF Generation Function ---
    // const generatePDF = useCallback(() => { ... }, []);

    // --- Render Logic (Keep error handling) ---
    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'red', fontFamily: 'Arial, sans-serif' }}>
                <h2>Error Loading Transcript</h2>
                <p>{error}</p>
                <a href="/student-portal" style={{color: '#007bff', textDecoration: 'underline', marginRight: '15px'}}>Back to Portal</a>
                <a href="/" style={{color: '#007bff', textDecoration: 'underline'}}>Go to Login</a>
            </div>
        );
    }

    const displaySid = studentId && studentId !== 'ERRORID' ? String(studentId).padStart(6, '0') : 'N/A';

    return (
        <>
            <Head>
                <title>Transcript - Confucius Institute</title>
                <meta name="description" content="Confucius Institute Unofficial Academic Transcript" />
                {/* Removed html2pdf script reference */}
            </Head>
            {/* Keep JsBarcode script */}
             <Script
                src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"
                strategy="afterInteractive"
                onLoad={() => {
                    if (window.JsBarcode && document.getElementById('barcode-svg') && displaySid !== 'N/A') {
                        try { window.JsBarcode('#barcode-svg', displaySid, { format: 'CODE128', lineColor: '#000', width: 2, height: 50, displayValue: true, textMargin: 5 }); }
                        catch (e) { console.error("JsBarcode error:", e); }
                    } else if (displaySid === 'N/A') { console.warn("Student ID missing, cannot generate barcode."); }
                }}
                onError={(e) => { console.error("Failed to load JsBarcode script:", e); }}
            />

            {/* Transcript Layout */}
            <div className="transcript-container" id="transcript-content"> {/* id can remain if needed elsewhere */}
                <div className="watermark">OFFICIAL TRANSCRIPT</div>
                {/* Header, Meta, Student Info Sections remain the same */}
                <div className="header"> <img src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png" alt="Confucius Institute Logo" className="logo" /><div className="school-info"><h1>Confucius Institute at Kyrgyz National University</h1><p>66 Manas Avenue, Bishkek, 720033, Kyrgyz Republic</p></div><div className="transcript-title">Unofficial Academic Transcript</div></div>
                <div className="meta-info"><span id="transcript-no">{transcriptNo || 'Transcript No. ...'}</span><span id="print-date">{printDate ? `Date Issued: ${printDate}`: 'Date Issued: ...'}</span></div>
                <div className="student-info"><h2>Student Information</h2><div className="info-grid"><div><strong>Student Name:</strong> <span id="student-name">{fullName || '...'}</span></div><div><strong>Student ID:</strong> <span id="student-id">{displaySid}</span></div><div><strong>Date of Birth:</strong> <span id="student-dob">{dateOfBirth || '...'}</span></div><div><strong>Program:</strong> <span>汉语学习项目</span></div><div><strong>Enrollment Status:</strong> <span>Active</span></div></div></div>

                {/* Coursework Section remains the same */}
                <div className="coursework"><h2>Institutional Coursework</h2><div id="course-tables">{coursesData.selectedCourses.length === 0 && <p>No course data available.</p>}{coursesData.selectedCourses.map((termData, termIdx) => (<div className="term-courses" key={termIdx}><div className="term-header">{termData.term}</div><table className="course-table"><thead><tr><th>Course ID</th><th>Course Title</th><th>Grade</th><th>Credits</th></tr></thead><tbody>{termData.courses.map((course, courseIdx) => (<tr key={courseIdx}><td>{course.courseId}</td><td>{course.title}</td><td>{course.grade}</td><td>{course.credit.toFixed(1)}</td></tr>))}</tbody></table></div>))}</div></div>
                {/* Summary Section remains the same */}
                <div className="summary"><h2>Academic Summary</h2><div className="info-grid"><div><strong>Total Attempted Credits:</strong> <span id="total-attempted">{coursesData.totalAttempted.toFixed(1)}</span></div><div><strong>Total Earned Credits:</strong> <span id="total-earned">{coursesData.totalEarned.toFixed(1)}</span></div><div><strong>Total Quality Points:</strong> <span id="total-quality-points">{coursesData.totalQualityPoints.toFixed(2)}</span></div><div><strong>Cumulative GPA:</strong> <span id="cumulative-gpa">{coursesData.gpa}</span></div></div></div>
                {/* Legend Section remains the same */}
                <div className="legend"><h2>Grading System</h2><table><thead><tr><th>Grade</th><th>Quality Points</th></tr></thead><tbody><tr><td>A</td><td>4.0</td></tr><tr><td>A-</td><td>3.7</td></tr><tr><td>B+</td><td>3.3</td></tr><tr><td>B</td><td>3.0</td></tr><tr><td>C+</td><td>2.3</td></tr><tr><td>C</td><td>2.0</td></tr><tr><td>W</td><td>Withdrawal (No point value)</td></tr></tbody></table></div>
                {/* Footer Section remains the same */}
                <div className="footer"><p>*** End of Unofficial Transcript ***</p><p>Page 1 of 1</p></div>
                {/* Barcode Section remains the same */}
                <div className="barcode">{displaySid !== 'N/A' ? (<svg id="barcode-svg" width="200" height="70"></svg>) : (<p style={{color: 'grey', fontSize: '12px', marginTop: '5px', height: '70px', display:'flex', alignItems:'center', justifyContent:'center'}}>Barcode N/A (ID Missing)</p>)}</div>
            </div>

            {/* --- Removed PDF Download Button Container --- */}
            {/*
            <div className="pdf-button-container">
                <button onClick={generatePDF} disabled={isGeneratingPdf}>
                    {isGeneratingPdf ? 'Generating PDF...' : 'Download Transcript (PDF)'}
                </button>
            </div>
            */}


            {/* Keep the CSS styles */}
            <style jsx>{`
                /* --- Paste the entire CSS block from the previous version here --- */
                 body { background-color: #f0f2f5; font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px; }
                .transcript-container { background: #fff; padding: 40px 50px; margin: 20px auto; max-width: 8.5in; /* min-height: 11in; */ box-shadow: 0 4px 12px rgba(0,0,0,0.1); position: relative; font-size: 10pt; line-height: 1.4; color: #333; }
                .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 72px; color: rgba(0, 86, 179, 0.08); font-weight: bold; pointer-events: none; user-select: none; white-space: nowrap; z-index: 0; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0056b3; padding-bottom: 15px; }
                .logo { height: 60px; margin-bottom: 5px; }
                .school-info h1 { margin: 5px 0; font-size: 16pt; font-weight: bold; color: #0056b3; }
                .school-info p { margin: 2px 0; font-size: 9pt; color: #555; }
                .transcript-title { font-size: 14pt; font-weight: bold; margin-top: 10px; margin-bottom: 20px; text-align: center; color: #333; }
                .meta-info { display: flex; justify-content: space-between; font-size: 9pt; margin-bottom: 20px; color: #444; }
                .student-info { margin-bottom: 25px; padding: 15px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; }
                .student-info h2, .coursework h2, .summary h2, .legend h2 { font-size: 12pt; font-weight: bold; color: #0056b3; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 0; margin-bottom: 10px; }
                .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 5px 20px; }
                .info-grid div { font-size: 10pt; }
                .info-grid strong { font-weight: 600; display: inline-block; min-width: 100px; }
                .coursework { margin-bottom: 20px; }
                .course-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9.5pt; }
                .course-table th, .course-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top;}
                .course-table th { background-color: #e9ecef; font-weight: bold; text-align: center; }
                .course-table td:nth-child(1), .course-table td:nth-child(2), .course-table td:nth-child(4), .course-table td:nth-child(5) { text-align: center; white-space: nowrap; }
                .term-header { font-weight: bold; background-color: #f8f9fa; padding: 8px; margin-top: 15px; border-top: 1px solid #ccc; }
                .summary { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ccc; }
                .summary .info-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
                .legend { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ccc; font-size: 9pt; }
                .legend table { width: auto; border-collapse: collapse; }
                .legend th, .legend td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
                .legend th { background-color: #f8f8f8; }
                .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #0056b3; font-size: 8pt; color: #666; text-align: center; }
                .footer p { margin: 3px 0; }
                .barcode { margin-top: 18px; display: flex; flex-direction: column; align-items: center; padding-bottom: 20px; }
                /* Removed .pdf-button-container styles as button is removed */

                @media print {
                    /* Print styles remain */
                    body { background-color: #fff; padding: 0; margin: 0; font-size: 10pt; }
                    /* .pdf-button-container { display: none; } */ /* No longer needed */
                    .transcript-container { box-shadow: none; margin: 0; max-width: 100%; padding: 0.5in; border: none; }
                    .watermark { color: rgba(0, 86, 179, 0.08) !important; }
                    .course-table th, .course-table td { font-size: 9pt; padding: 4px 6px;}
                    .info-grid div { font-size: 9.5pt; }
                    .legend { font-size: 8.5pt; }
                    .footer { font-size: 7.5pt; }
                    .term-courses, .summary, .legend { page-break-inside: avoid; }
                    .coursework h2, .summary h2, .legend h2 { page-break-before: auto; }
                }
            `}</style>
        </>
    );
}
