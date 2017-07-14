const fetch = require('node-fetch')
const _ = require('lodash')

const username = 'DOCKERCLOUD_USERNAME'
const apiKey = 'DOCKERCLOUD_APIKEY'
const PAGE_SIZE = 50

let nodeVers = []

function dockerCloud (path) {
  const options = {
    headers: {
      Authorization: `Basic ${new Buffer(username + ':' + apiKey).toString('base64')}`
    }
  }

  return fetch(`https://cloud.docker.com/${path}`, options)
    .then(res => res.json())
    .catch(console.err)
}

function getContainer(container) {
  return dockerCloud(`/api/app/v1/container/${container.uuid}`)
}

function getContainers(offset) {
  return dockerCloud(`/api/app/v1/container?limit=${PAGE_SIZE}&offset=${offset}`)
    .then(containers => {
      console.log('getContainers', containers.objects.length)
      return Promise.all(containers.objects.map(container => getContainer(container)))
    })
}

function start(offset) {
  console.log('start', offset)
  getContainers(offset)
    .then(containers => {
      const nodeContainers = _.chain(containers)
        .uniqBy('image_name')
        .map(o => {
          Object.keys(o.link_variables).forEach(key => {
            if (key.indexOf('NODE_VERSION') !== -1) o.nodeVersion = o.link_variables[key]
          })
          return o
        })
        .filter(o => o.nodeVersion)
        .map(o => {
          return {
            image: o.image_name,
            tag: o.image_tag,
            nodeVersion: o.nodeVersion
          }
        })
        .value()
      return {
        nodeContainers,
        containers
      }
    })
    .then(({ nodeContainers, containers }) => {
      nodeVers = nodeVers.concat(nodeContainers)
      if (containers.length > 0) {
        start(offset + PAGE_SIZE)
      } else {
        nodeVers = _.sortBy(nodeVers, o => o.nodeVersion)

        nodeVers.forEach(o => {
          console.log(o.image, ',', o.nodeVersion)
        })
      }
    })
}

start(0)
