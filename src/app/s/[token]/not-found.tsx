import { Wordmark } from '../../mark';

export default function NotFound() {
  return (
    <div className="survey-shell client-surface">
      <div className="sform">
        <div className="head">
          <Wordmark width={150} />
        </div>
        <div className="step">
          <h1>We can&apos;t find that questionnaire.</h1>
          <p className="th" style={{ marginBottom: 26 }}>
            ไม่พบแบบสอบถามนี้
          </p>
          <p className="intro">
            The link may have been copied incompletely. Please check it against the message you were
            sent, or ask the person who forwarded it to send it again.
          </p>
          <p className="th" style={{ maxWidth: '58ch' }}>
            ลิงก์อาจไม่สมบูรณ์ กรุณาตรวจสอบอีกครั้ง หรือขอลิงก์ใหม่จากผู้ที่ส่งให้คุณ
          </p>
        </div>
      </div>
    </div>
  );
}
