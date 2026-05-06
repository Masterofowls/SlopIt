import React, { useState } from "react";
import Button from "../ui/Button";
import Card from "../ui/Card";
import "./PostCreator.css";
import WindowCard from "../ui/WindowCard";

const PostCreator = ({ onCreatePost }) => {
  const [postType, setPostType] = useState("text");
  const [content, setContent] = useState("");
  const [images, setImages] = useState([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const newImages = files.map((file) => URL.createObjectURL(file));
    setImages([...images, ...newImages]);
  };

  const handleRemoveImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleAddOption = () => {
    setOptions([...options, ""]);
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const postData = {
      type: postType,
      content,
      timestamp: new Date().toISOString(),
    };

    if (postType === "image" && images.length > 0) {
      if (images.length === 1) {
        postData.imageUrl = images[0];
      } else {
        postData.images = images;
      }
    } else if (postType === "video") {
      postData.videoUrl = videoUrl;
      postData.thumbnailUrl = videoUrl; // In real app, this would be a separate thumbnail
    } else if (postType === "questionnaire") {
      postData.question = question;
      postData.options = options
        .filter((opt) => opt.trim())
        .map((opt, index) => ({ id: index + 1, text: opt, votes: 0 }));
      postData.totalVotes = 0;
    }

    onCreatePost(postData);

    // Reset form
    setContent("");
    setImages([]);
    setVideoUrl("");
    setQuestion("");
    setOptions(["", ""]);
  };

  return (
    <div className="post-creator">
      <div className="radioactive-fog-container">
        <svg
          className="fog-svg fog-1"
          viewBox="0 0 1920 600"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="fog-outline"
            d="M0,300 Q200,250 400,300 T800,300 T1200,300 T1600,300 T1920,300"
            fill="none"
            stroke="#00ff00"
            strokeWidth="4"
          />
          <path
            className="fog-fill"
            d="M0,300 Q200,250 400,300 T800,300 T1200,300 T1600,300 T1920,300 L1920,600 L0,600 Z"
            fill="rgba(0,255,0,0.2)"
          />
        </svg>
        <svg
          className="fog-svg fog-2"
          viewBox="0 0 1920 600"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="fog-outline"
            d="M0,350 Q250,280 500,350 T1000,350 T1500,350 T1920,350"
            fill="none"
            stroke="#00ff00"
            strokeWidth="4"
          />
          <path
            className="fog-fill"
            d="M0,350 Q250,280 500,350 T1000,350 T1500,350 T1920,350 L1920,600 L0,600 Z"
            fill="rgba(0,255,100,0.15)"
          />
        </svg>
        <svg
          className="fog-svg fog-3"
          viewBox="0 0 1920 600"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="fog-outline"
            d="M0,280 Q300,220 600,280 T1200,280 T1800,280 T1920,280"
            fill="none"
            stroke="#00ff00"
            strokeWidth="4"
          />
          <path
            className="fog-fill"
            d="M0,280 Q300,220 600,280 T1200,280 T1800,280 T1920,280 L1920,600 L0,600 Z"
            fill="rgba(100,255,0,0.1)"
          />
        </svg>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="post-type-selector">
          <Button
            type="button"
            variant={postType === "text" ? "primary" : "outline"}
            size="small"
            onClick={() => setPostType("text")}
          >
            <img src="../../../dist/icons/text.png" className="icon"></img>
          </Button>
          <Button
            type="button"
            variant={postType === "image" ? "primary" : "outline"}
            size="small"
            onClick={() => setPostType("image")}
          >
            <img src="../../../dist/icons/image.png" className="icon"></img>
          </Button>
          <Button
            type="button"
            variant={postType === "video" ? "primary" : "outline"}
            size="small"
            onClick={() => setPostType("video")}
          >
            <img src="../../../dist/icons/video.png" className="icon"></img>
          </Button>

          <Button
            type="button"
            variant={postType === "questionnaire" ? "primary" : "outline"}
            size="small"
            onClick={() => setPostType("questionnaire")}
          >
            <img src="../../../dist/icons/poll.png" className="icon"></img>
          </Button>
        </div>

        {postType === "text" && (
          <div className="form-group">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="post-textarea"
              rows={4}
              required
            />
          </div>
        )}

        {postType === "image" && (
          <>
            <div className="form-group">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Add a caption..."
                className="post-textarea"
                rows={2}
              />
            </div>
            <div className="form-group">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="file-input"
                required
              />
              {images.length > 0 && (
                <div className="image-preview">
                  {images.map((image, index) => (
                    <div key={index} className="image-item">
                      <img src={image} alt={`Preview ${index + 1}`} />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="remove-image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {postType === "video" && (
          <>
            <div className="form-group">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Add a caption..."
                className="post-textarea"
                rows={2}
              />
            </div>
            <div className="form-group">
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Enter video URL"
                className="url-input"
                required
              />
            </div>
          </>
        )}

        {postType === "questionnaire" && (
          <>
            <div className="form-group">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Add some context..."
                className="post-textarea"
                rows={2}
              />
            </div>
            <div className="form-group">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What's your question?"
                className="text-input"
                required
              />
            </div>
            <div className="form-group">
              <label className="options-label">Options:</label>
              {options.map((option, index) => (
                <div key={index} className="option-input-group">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="text-input"
                    required
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="remove-option"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="small"
                onClick={handleAddOption}
                className="add-option-btn"
              >
                + Add Option
              </Button>
            </div>
          </>
        )}

        <div className="form-actions">
          <Button type="submit" variant="primary" size="large">
            Create Post
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PostCreator;
