import * as FaIcons from 'react-icons/fa';
import * as BiIcons from 'react-icons/bi';
import * as HiIcons from 'react-icons/hi';
import * as FcIcons from 'react-icons/fc';

interface IconRendererProps {
  icon: string; // The icon name or emoji
  type: 'emoji' | 'fa' | 'bi' | 'hi' | 'fc';
  size?: string | number;
  className?: string;
}

const IconRenderer: React.FC<IconRendererProps> = ({ icon, type, size, className }) => {
  if (type === 'emoji') {
    return <span className={className} style={{ fontSize: size }}>{icon}</span>;
  }

  let IconComponent: any = null;

  try {
    if (type === 'fa') IconComponent = (FaIcons as any)[icon];
    if (type === 'bi') IconComponent = (BiIcons as any)[icon];
    if (type === 'hi') IconComponent = (HiIcons as any)[icon];
    if (type === 'fc') IconComponent = (FcIcons as any)[icon];
  } catch (e) {
    console.error(`Icon ${icon} not found in ${type}`);
  }

  if (!IconComponent) {
    return <span className={className} style={{ fontSize: size }}>❓</span>;
  }

  return <IconComponent size={size} className={className} />;
};

export default IconRenderer;
