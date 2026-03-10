// Climbing grade systems and utilities

export type RopedGradeSystem = 'yds' | 'french' | 'aus';
export type BoulderingGradeSystem = 'v_scale' | 'font';

// YDS (Yosemite Decimal System) grades
export const YDS_GRADES = [
  '5.4', '5.5', '5.6', '5.7', '5.8', '5.9',
  '5.10a', '5.10b', '5.10c', '5.10d',
  '5.11a', '5.11b', '5.11c', '5.11d',
  '5.12a', '5.12b', '5.12c', '5.12d',
  '5.13a', '5.13b', '5.13c', '5.13d',
  '5.14a', '5.14b', '5.14c', '5.14d',
  '5.15a', '5.15b', '5.15c', '5.15d',
];

// French grades
export const FRENCH_GRADES = [
  '4a', '4b', '4c', '5a', '5b', '5c',
  '6a', '6a+', '6b', '6b+', '6c', '6c+',
  '7a', '7a+', '7b', '7b+', '7c', '7c+',
  '8a', '8a+', '8b', '8b+', '8c', '8c+',
  '9a', '9a+', '9b', '9b+', '9c',
];

// Australian grades
export const AUS_GRADES = Array.from({ length: 39 }, (_, i) => String(i + 1));

// V-scale grades
export const V_SCALE_GRADES = [
  'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9',
  'V10', 'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17',
];

// Font bouldering grades
export const FONT_GRADES = [
  '4', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+',
  '7A', '7A+', '7B', '7B+', '7C', '7C+',
  '8A', '8A+', '8B', '8B+', '8C', '8C+',
  '9A'
];

export const GRADE_SYSTEMS = {
  roped: {
    yds: { name: 'YDS (Yosemite Decimal System)', grades: YDS_GRADES },
    french: { name: 'French', grades: FRENCH_GRADES },
    aus: { name: 'Australian', grades: AUS_GRADES },
  },
  bouldering: {
    v_scale: { name: 'V-Scale', grades: V_SCALE_GRADES },
    font: { name: 'Font', grades: FONT_GRADES },
  },
};

// Helper function to get grade index for comparison
export const getGradeIndex = (grade: string, system: RopedGradeSystem | BoulderingGradeSystem): number => {
  let grades: string[] = [];
  
  if (system === 'yds') grades = YDS_GRADES;
  else if (system === 'french') grades = FRENCH_GRADES;
  else if (system === 'aus') grades = AUS_GRADES;
  else if (system === 'v_scale') grades = V_SCALE_GRADES;
  else if (system === 'font') grades = FONT_GRADES;
  
  return grades.indexOf(grade);
};

// Helper function to compare two grades
export const compareGrades = (
  grade1: string,
  grade2: string,
  system: RopedGradeSystem | BoulderingGradeSystem
): number => {
  const index1 = getGradeIndex(grade1, system);
  const index2 = getGradeIndex(grade2, system);
  
  if (index1 === -1 || index2 === -1) return 0;
  return index1 - index2;
};
