import React from 'react';
import { FileCode, Info } from 'lucide-react';
import type { TemplateConfig } from '../../types';

interface TemplatesTabProps {
  config: TemplateConfig;
  onChange: (c: TemplateConfig) => void;
}

const TEMPLATE_FIELDS: Array<{
  key: keyof TemplateConfig;
  label: string;
  icon: string;
  vars: string[];
  placeholder: string;
}> = [
  {
    key: 'follow', label: 'New Follower', icon: '👥',
    vars: ['{username}'],
    placeholder: 'Thanks {username} for following!',
  },
  {
    key: 'subscribe', label: 'New Subscriber', icon: '👑',
    vars: ['{username}'],
    placeholder: 'Welcome {username} to the squad!',
  },
  {
    key: 'gift', label: 'Gift Received', icon: '🎁',
    vars: ['{username}', '{gift}', '{diamonds}', '{count}'],
    placeholder: '{username} sent a {gift} — thank you!',
  },
  {
    key: 'share', label: 'Stream Shared', icon: '📢',
    vars: ['{username}'],
    placeholder: '{username} shared the stream! 🔥',
  },
  {
    key: 'like', label: 'Like Burst', icon: '❤️',
    vars: ['{username}', '{count}'],
    placeholder: '{username} liked the stream!',
  },
  {
    key: 'join', label: 'Viewer Joined', icon: '🚪',
    vars: ['{username}'],
    placeholder: 'Welcome {username}!',
  },
];

export default function TemplatesTab({ config, onChange }: TemplatesTabProps) {
  const update = (key: keyof TemplateConfig, val: string) =>
    onChange({ ...config, [key]: val });

  return (
    <div className="space-y-5">
      <div
        className="flex items-start gap-2 p-3 rounded-ios-sm text-[11px] text-white/40"
        style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.12)' }}
      >
        <Info size={13} className="text-[#0A84FF] flex-shrink-0 mt-0.5" />
        <span>Use <code className="font-mono text-[#0A84FF] bg-[#0A84FF]/10 px-1 rounded">{'{variable}'}</code> placeholders. Leave empty to disable TTS for that event.</span>
      </div>

      <div className="space-y-4">
        {TEMPLATE_FIELDS.map(({ key, label, icon, vars, placeholder }) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-white/70 flex items-center gap-1.5">
                <span>{icon}</span> {label}
              </p>
              <div className="flex gap-1 flex-wrap justify-end">
                {vars.map(v => (
                  <span
                    key={v}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded cursor-pointer"
                    style={{ background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.2)', color: '#FF9F0A' }}
                    onClick={() => update(key, (config[key] ? config[key] + ' ' : '') + v)}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative">
              <FileCode size={12} className="absolute left-3 top-3.5 text-white/20" />
              <input
                type="text"
                value={config[key]}
                onChange={(e) => update(key, e.target.value)}
                placeholder={placeholder}
                className="input-cosmic pl-8 text-xs font-mono"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
