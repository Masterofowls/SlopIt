import React from 'react';
import TextPost from './TextPost';
import ImagePost from './ImagePostNew';
import VideoPost from './VideoPost';
import QuestionnairePost from './QuestionnairePost';

const PostFactory = ({ post }) => {
  switch (post.type) {
    case 'text':
      return <TextPost post={post} />;
    case 'image':
    case 'collage':
      return <ImagePost post={post} />;
    case 'video':
      return <VideoPost post={post} />;
    case 'questionnaire':
      return <QuestionnairePost post={post} />;
    default:
      return <TextPost post={post} />;
  }
};

export default PostFactory;
