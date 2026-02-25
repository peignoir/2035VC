import type { SlideImage } from '../types';
import styles from './SlideCanvas.module.css';

interface SlideCanvasProps {
  slide: SlideImage;
  className?: string;
}

export function SlideCanvas({ slide, className }: SlideCanvasProps) {
  return (
    <img
      src={slide.objectUrl}
      alt={`Slide ${slide.pageNumber}`}
      className={`${styles.slide} ${className ?? ''}`}
      draggable={false}
    />
  );
}
