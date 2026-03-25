'use client'
// /app/approach/[slug]/page.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ApproachPage() {
  const params = useParams();
  const [approach, setApproach] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'all-time'>('all-time');
  const [tabs] = useState(['Top Rețete', 'Top Scurte', 'Top Videouri']);

  useEffect(() => {
    const slug = params.slug as string;
    setApproach(slug);
  }, [params.slug]);

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl">Bucătărie: {approach}</h1>
        <div className="flex space-x-2">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as 'today' | 'week' | 'all-time')}
            className="p-2 border rounded"
          >
            <option value="today">Azi</option>
            <option value="week">Săptămâna</option>
            <option value="all-time">Tot timpul</option>
          </select>
          <div className="relative">
            <select
              className="p-2 border rounded pl-10"
            >
              <option>Top Rețete</option>
              <option>Top Scurte</option>
              <option>Top Videouri</option>
            </select>
            <div className="absolute left-0 top-0 h-full w-10 bg-white">
              <div className="h-full flex items-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tabs.map((tab, index) => (
          <div key={index} className="bg-white p-4 rounded shadow">
            <h2 className="text-lg font-semibold mb-2">{tab}</h2>
            <p className="text-sm text-gray-500">{timeFilter === 'today' ? 'Top-ul zilei' : timeFilter === 'week' ? 'Top-ul săptămânii' : 'Top-ul general'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
