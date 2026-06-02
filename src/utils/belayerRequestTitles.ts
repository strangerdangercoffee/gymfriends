/**
 * Display title for belayer / rally pads posts in feeds and when persisting new posts.
 */
export function getBelayerRequestFeedTitle(
  authorName: string | undefined,
  postType: 'belayer_request' | 'rally_pads_request' | undefined,
  climbingType: 'lead' | 'top_rope' | 'bouldering' | 'traditional' | 'any' | undefined
): string {
  const name = (authorName || 'Someone').trim() || 'Someone';
  if (postType === 'rally_pads_request') {
    return `${name} is rallying pads`;
  }
  switch (climbingType) {
    case 'lead':
      return `${name} is looking for a lead belayer`;
    case 'top_rope':
      return `${name} is looking for a top rope belayer`;
    case 'traditional':
      return `${name} is looking for a trad belayer`;
    case 'bouldering':
      return `${name} is looking for a bouldering partner`;
    case 'any':
    default:
      return `${name} is looking for a belayer`;
  }
}
