import { Route, Routes } from 'react-router';
import DevGallery from './pages/DevGallery';
import Home from './pages/Home';

export default function App() {
  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dev/gallery" element={<DevGallery />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}
