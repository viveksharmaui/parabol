import {useEffect} from 'react'
import useAtmosphere from './useAtmosphere'
import {commitLocalUpdate} from 'react-relay'

// pageName is shown on the header of mobile devices
const useDocumentTitle = (title: string, pageName: string) => {
  const atmosphere = useAtmosphere()
  useEffect(() => {
    document.title = title
  }, [title])
  useEffect(() => {
    commitLocalUpdate(atmosphere, (store) => {
      const viewer = store.getRoot().getLinkedRecord('viewer')
      if (!viewer) return
      viewer.setValue(pageName, 'pageName')
    })
  }, [pageName])
}

export default useDocumentTitle
