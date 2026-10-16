import React from 'react';

interface CJNLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  variant?: 'light' | 'dark';
}

export const CJNLogo: React.FC<CJNLogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
  variant = 'light',
}) => {
  const sizeMap = {
    sm: { w: 120, h: 48, fontSize: 'text-[9px]' },
    md: { w: 160, h: 64, fontSize: 'text-[11px]' },
    lg: { w: 220, h: 88, fontSize: 'text-xs' },
    xl: { w: 300, h: 120, fontSize: 'text-sm' },
  };

  const { w, h, fontSize } = sizeMap[size];

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <svg
        width={w}
        height={h}
        viewBox="0 0 280 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform duration-300 hover:scale-105"
      >
        {/* Colorful handprints splash at top-left */}
        <g id="handprints-splash" opacity="0.95">
          {/* Red handprint */}
          <path
            d="M32 18 C30 8, 38 4, 44 10 C46 12, 48 20, 48 26 C54 16, 62 14, 66 22 C68 26, 66 34, 64 40 C72 32, 80 34, 82 42 C83 48, 78 56, 72 60 C80 58, 86 64, 84 72 C80 80, 68 82, 56 78 C46 84, 34 82, 30 72 C26 62, 28 46, 32 36 Z"
            fill="#DC2626"
          />
          {/* Golden Yellow handprint */}
          <path
            d="M74 24 C78 14, 90 14, 92 24 C94 30, 90 38, 88 44 C98 38, 108 42, 106 52 C104 58, 96 66, 90 70 C100 70, 104 80, 98 88 C92 94, 80 94, 72 86 C64 88, 56 82, 58 72 C60 62, 68 50, 74 38 Z"
            fill="#EAB308"
            opacity="0.9"
          />
          {/* Lime Green handprint */}
          <path
            d="M24 48 C20 40, 28 34, 34 40 C38 44, 40 52, 40 60 C48 54, 56 60, 54 68 C52 74, 46 82, 40 88 C48 88, 50 98, 44 104 C38 108, 26 104, 20 96 C16 98, 10 92, 12 84 C14 74, 20 62, 24 48 Z"
            fill="#65A30D"
            opacity="0.95"
          />
        </g>

        {/* CJN Bold Sky-Blue Letters */}
        <g id="letters-cjn">
          {/* Letter C */}
          <path
            d="M78 30 C78 12, 126 12, 126 30 L112 30 C112 22, 94 22, 94 30 L94 82 C94 90, 112 90, 112 82 L126 82 C126 100, 78 100, 78 82 Z"
            fill="#0284C7"
          />
          {/* Vertical text inside C: "COMITE" */}
          <text
            x="86"
            y="76"
            fill="#FFFFFF"
            fontSize="9"
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            transform="rotate(-90 86 76)"
            letterSpacing="2"
          >
            COMITE
          </text>

          {/* Letter J */}
          <path
            d="M130 92 C130 102, 148 102, 154 94 L154 22 L170 22 L170 92 C170 110, 130 110, 130 92 Z"
            fill="#0284C7"
          />
          {/* Vertical text inside J: "JUVENIL" */}
          <text
            x="162"
            y="78"
            fill="#FFFFFF"
            fontSize="8.5"
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            transform="rotate(-90 162 78)"
            letterSpacing="2"
          >
            JUVENIL
          </text>

          {/* Letter N */}
          <path
            d="M176 16 L192 16 L218 84 L218 16 L234 16 L234 104 L218 104 L192 36 L192 104 L176 104 Z"
            fill="#0284C7"
          />
          {/* Vertical text inside N: "NACIONAL" */}
          <text
            x="184"
            y="82"
            fill="#FFFFFF"
            fontSize="8"
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            transform="rotate(-90 184 82)"
            letterSpacing="1.5"
          >
            NACIONAL
          </text>
        </g>
      </svg>

      {/* Subtitle: Unión Cristiana Evangélica */}
      {showSubtitle && (
        <span
          className={`font-bold tracking-tight text-center ${fontSize} ${
            variant === 'dark' ? 'text-sky-300' : 'text-[#0284C7]'
          }`}
        >
          Unión Cristiana Evangélica
        </span>
      )}
    </div>
  );
};
