export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'yqqnpmhhemytzkeuuchv.supabase.co';

    const proxied = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });

    const response = await fetch(proxied);

    // Rewrite any redirect Location headers back to your domain
    const newHeaders = new Headers(response.headers);
    const location = newHeaders.get('location');
    if (location) {
      newHeaders.set(
        'location',
        location.replace('yqqnpmhhemytzkeuuchv.supabase.co', 'auth.rallyclimbing.com')
      );
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};