import React, { useState } from 'react';
import Post from './Post';
import './QuestionnairePost.css';

const QuestionnairePost = ({ post }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);

  const handleVote = (optionId) => {
    if (!hasVoted) {
      setSelectedOption(optionId);
      setHasVoted(true);
    }
  };

  const getVotePercentage = (votes) => {
    if (post.totalVotes === 0) return 0;
    return Math.round((votes / post.totalVotes) * 100);
  };

  return (
    <Post post={post}>
      <div className="post-questionnaire">
        <h3 className="question-title">{post.question}</h3>
        <div className="options-list">
          {post.options.map((option) => (
            <button
              key={option.id}
              className={`option-button ${hasVoted ? 'voted' : ''} ${selectedOption === option.id ? 'selected' : ''}`}
              onClick={() => handleVote(option.id)}
              disabled={hasVoted}
            >
              <div className="option-content">
                <span className="option-text">{option.text}</span>
                {hasVoted && (
                  <div className="vote-results">
                    <div className="vote-percentage">
                      {getVotePercentage(option.votes)}%
                    </div>
                    <div 
                      className="vote-bar"
                      style={{ width: `${getVotePercentage(option.votes)}%` }}
                    />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        {hasVoted && (
          <div className="total-votes">
            Total votes: {post.totalVotes}
          </div>
        )}
      </div>
    </Post>
  );
};

export default QuestionnairePost;
