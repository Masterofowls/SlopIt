import "./ToxicityMeter.css";

export default function ToxicityMeter({ likeCount = 0, dislikeCount = 0 }) {
  const total = likeCount + dislikeCount;

  if (total === 0) {
    return (
      <div className="toxicity-meter toxicity-meter--analyzing">
        <span className="toxicity-label">TOXICITY:</span>
        <span className="toxicity-scanning">ANALYZING...</span>
      </div>
    );
  }

  const pct = Math.round((dislikeCount / total) * 100);
  const level =
    pct >= 70
      ? "critical"
      : pct >= 40
        ? "elevated"
        : pct >= 20
          ? "moderate"
          : "low";

  return (
    <div className="toxicity-meter" data-level={level}>
      <span className="toxicity-label">TOXICITY:</span>
      <div className="toxicity-bar-wrap">
        <div className="toxicity-bar" style={{ width: `${pct}%` }} />
      </div>
      <span className="toxicity-pct">{pct}%</span>
    </div>
  );
}
