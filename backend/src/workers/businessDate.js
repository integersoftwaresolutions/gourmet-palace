const {addDays}=require('../utils/dateRange');
function completedBusinessDateFromParts(parts,cutoffHour=4){
  const localDate=`${parts.year}-${parts.month}-${parts.day}`;
  return addDays(localDate,Number(parts.hour)<cutoffHour?-2:-1);
}
module.exports={completedBusinessDateFromParts};
