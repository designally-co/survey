import { Wordmark } from '../../mark';

/**
 * Shown when a survey resolves to no questions — the questionnaire it was sent
 * with is not in the database. The client cannot fix this and should not be
 * asked to try, so it says plainly that the problem is ours.
 */
export default function NotReady({ clientName }: { clientName: string }) {
  return (
    <div className="survey-shell client-surface">
      <div className="sform">
        <div className="head">
          <Wordmark width={150} />
          <span className="proj">{clientName}</span>
        </div>
        <div className="step">
          <h1>This questionnaire isn&apos;t ready yet.</h1>
          <p className="th" style={{ marginBottom: 26 }}>
            แบบสอบถามนี้ยังไม่พร้อมใช้งาน
          </p>
          <p className="intro">
            Something is wrong at our end — the questions haven&apos;t loaded. Nothing you do here
            would be saved, so please don&apos;t start. We&apos;ve been told, and your project lead
            will send a working link.
          </p>
          <p className="th" style={{ maxWidth: '58ch' }}>
            เกิดข้อผิดพลาดจากทางเรา คำถามยังโหลดไม่ขึ้น กรุณารอลิงก์ใหม่จากผู้ดูแลโปรเจกต์ของคุณ
          </p>
        </div>
      </div>
    </div>
  );
}
