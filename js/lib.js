import {router} from './router';
import {store} from 'storxy';
import {$context, $onDestroy, $tick} from 'malinajs/runtime.js';

export function createRouteObject(options){

  const type = options.fallback ? 'fallbacks' : 'childs';

  const metaStore = store({});
  const meta = {
    url: '',
    query: '',
    params:{},
    subscribe: metaStore.subscribe
  };
  metaStore.$ = meta;

  const route = {
    un:null,
    exact: false,
    pattern: '',
    parent: $context.parent,
    fallback: options.fallback,
    childs: new Set(),
    activeChilds: new Set(),
    fallbacks: new Set(),
    makePattern(path){
      route.exact = !path.endsWith('/*');
      route.pattern = formatPath(`${route.parent && route.parent.pattern || ''}${path}`);
    },
    register: () => {
      if(!route.parent) return;
      route.parent[type].add(route);
      return ()=>{
        route.parent[type].delete(route);
        route.un && route.un();
      };
    },
    show: ()=>{
      options.onShow();
      !route.fallback && route.parent && route.parent.activeChilds.add(route);
    },
    hide: ()=>{
      options.onHide();
      !route.fallback && route.parent && route.parent.activeChilds.delete(route);
    },
    match:(url)=>{
      const params = getParams(route.pattern,url);

      if(params && route.redirect && (!route.exact || (params.exact && route.exact))){
        return router.goto(route.redirect);
      }

      if(!route.fallback && params && (!route.exact || (route.exact && params.exact))){
        route.show();
        meta.params = params.params;
        metaStore.$ = meta;
      } else {
        route.hide();
      }

      $tick(()=>{
        if(params && route.childs.size > 0 && route.activeChilds.size == 0){
          let obj = route;
          while(obj.fallbacks.size == 0){
            obj = obj.parent;
            if(!obj) return;
          }
          obj && obj.fallbacks.forEach(fb => fb.show());
        }
      });
    },
    meta
  };

  route.makePattern(options.path);

  route.un = router.subscribe(r => {
    meta.url = r.path;
    meta.query = r.query;
    meta.params = {};
    metaStore.$ = meta;
    route.match(r.path);
  });

  $context.parent = route;
  $context.route = route.meta;

  $onDestroy(route.register());

  return route;
}


export function getParams(pattern,path){
  pattern = formatPath(pattern);
  path = formatPath(path);

  const keys = [];
  let params = {};
  let exact = true;
  let rx = pattern
    .split('/')
    .map(s => s.startsWith(':') ? (keys.push(s.slice(1)),'([^\\/]+)') : s)
    .join('\\/');

  let match = path.match(new RegExp(`^${rx}$`));
  if(!match) {
    exact = false;
    match = path.match(new RegExp(`^${rx=='\\/' ? '' : rx}/|^${rx}$`));
  }
  if(!match) return undefined;
  keys.forEach((key,i) => params[key] = match[i+1]);

  return {exact,params};
}

function formatPath(path){
  path = path.replace(/(^\/#)|(^\/\/#)|(^\/\/)|(\/\*$)|(\/$)/g,'');
  if(!path.startsWith('/')) path = '/'+path;
  return path;
}