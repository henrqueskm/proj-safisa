import React from 'react';
import { Skeleton } from './Skeleton';

const AppLoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 p-6 sm:p-12 flex flex-col gap-8">
      <div className="flex gap-4 items-center mb-4">
        <Skeleton className="w-16 h-16 rounded-2xl" />
        <div className="flex flex-col gap-3">
          <Skeleton className="w-64 h-8" />
          <Skeleton className="w-32 h-4" />
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <Skeleton className="w-full lg:w-[300px] h-96 rounded-2xl shrink-0" />
        <div className="flex flex-col gap-6 flex-1">
          <Skeleton className="w-full h-32 rounded-2xl" />
          <Skeleton className="w-full h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
};

export default AppLoadingScreen;
