import React from 'react';
import TextPost from './TextPost';
import ImagePost from './ImagePostNew';
import VideoPost from './VideoPost';
import QuestionnairePost from './QuestionnairePost';
import PollPost from "./PollPost";
import AlertPost from "./AlertPost";

const PostFactory = ({ post }) => {
  // Backend uses `kind`; legacy dummy data uses `type`
  const kind = post.kind || post.type;

  switch (kind) {
    case "poll":
      return <PollPost post={post} />;
    case "alert":
    case "news":
      return <AlertPost post={post} />;
    case "text":
      return <TextPost post={post} />;
    case "image":
    case "collage":
      return <ImagePost post={post} />;
    case "video":
      return <VideoPost post={post} />;
    case "questionnaire":
      return <QuestionnairePost post={post} />;
    default:
      console.warn(`[PostFactory] Unknown post kind: "${kind}"`, post);
      return <TextPost post={post} />;
  }
};

export default PostFactory;
