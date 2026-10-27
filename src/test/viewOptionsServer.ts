import type { ViewOptions } from '../api/viewOptions';
import type { ApiRoutes, RoutedRequest } from './apiRoutes';
import { jsonResponse } from './http';
import { makeViewOptions } from './m2Fixtures';

/** In-memory view-options backend: GET the list, PUT / DELETE each of `viewKeys`. */
export function viewOptionsRoutes(viewKeys: readonly string[], initial: readonly ViewOptions[] = []): ApiRoutes {
  let saved = [...initial];
  const routes: ApiRoutes = { 'GET /api/v1/view-options': () => jsonResponse(200, saved) };
  for (const viewKey of viewKeys) {
    routes[`PUT /api/v1/view-options/${viewKey}`] = (request: RoutedRequest) => {
      const row = makeViewOptions(viewKey, request.body as Partial<ViewOptions>);
      saved = [...saved.filter((item) => item.viewKey !== viewKey), row];
      return jsonResponse(200, row);
    };
    routes[`DELETE /api/v1/view-options/${viewKey}`] = () => {
      saved = saved.filter((item) => item.viewKey !== viewKey);
      return jsonResponse(204);
    };
  }
  return routes;
}
